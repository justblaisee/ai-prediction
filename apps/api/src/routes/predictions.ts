import { Router, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { createError } from '../middleware/errorHandler';
import { AuthRequest, authenticate } from '../middleware/auth';

const router = Router();
const TRAIN_STATUS_TTL_SECONDS = 60 * 60;

type TrainStatus = 'idle' | 'running' | 'completed' | 'failed';

type TrainStatusPayload = {
  status: TrainStatus;
  productId: string;
  organizationId: string;
  message: string;
  progress: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  modelType?: string;
  updatedAt: string;
};

function getTrainStatusKey(organizationId: string, productId: string): string {
  return `train:status:${organizationId}:${productId}`;
}

async function setTrainStatus(payload: TrainStatusPayload): Promise<void> {
  const key = getTrainStatusKey(payload.organizationId, payload.productId);
  await redis.set(key, JSON.stringify(payload), 'EX', TRAIN_STATUS_TTL_SECONDS);
}

async function readTrainStatus(organizationId: string, productId: string): Promise<TrainStatusPayload | null> {
  const key = getTrainStatusKey(organizationId, productId);
  const raw = await redis.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TrainStatusPayload;
  } catch {
    return null;
  }
}

// Get predictions for a product
router.get('/product/:productId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { productId } = req.params;
    const { days = '30' } = req.query;

    // Verify product belongs to organization
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        organizationId: req.user!.organizationId,
      },
    });

    if (!product) {
      throw createError('Product not found', 404);
    }

    const predictions = await prisma.prediction.findMany({
      where: {
        productId,
        predictedDate: {
          gte: new Date(),
        },
      },
      orderBy: { predictedDate: 'asc' },
      take: parseInt(days as string),
    });

    res.json(predictions);
  } catch (error) {
    next(error);
  }
});

// Get stockout prediction for a product
router.get('/stockout/:productId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { productId } = req.params;

    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        organizationId: req.user!.organizationId,
      },
      include: {
        predictions: {
          where: {
            predictedDate: { gte: new Date() },
          },
          orderBy: { predictedDate: 'asc' },
          take: 90,
        },
      },
    });

    if (!product) {
      throw createError('Product not found', 404);
    }

    if (product.predictions.length === 0) {
      res.json({
        productId,
        productName: product.name,
        sku: product.sku,
        currentStock: product.currentStock,
        stockoutDate: null,
        daysUntilStockout: null,
        confidence: null,
        message: 'No predictions available. Train the model first.',
      });
      return;
    }

    // Calculate cumulative demand
    let cumulativeDemand = product.currentStock;
    let stockoutDate = null;
    let daysUntilStockout = null;

    for (const prediction of product.predictions) {
      cumulativeDemand -= prediction.predictedQty;
      if (cumulativeDemand <= 0) {
        stockoutDate = prediction.predictedDate;
        daysUntilStockout = Math.ceil(
          (prediction.predictedDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        break;
      }
    }

    res.json({
      productId,
      productName: product.name,
      sku: product.sku,
      currentStock: product.currentStock,
      stockoutDate,
      daysUntilStockout,
      confidence: product.predictions[0]?.confidenceMax 
        ? { min: product.predictions[0].confidenceMin, max: product.predictions[0].confidenceMax }
        : null,
      message: daysUntilStockout !== null 
        ? `Stock will run out in ${daysUntilStockout} days`
        : 'Stock is sufficient for the prediction period',
    });
  } catch (error) {
    next(error);
  }
});

// Trigger model training (delegates to ML service)
router.post('/train/:productId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { productId } = req.params;
    const organizationId = req.user!.organizationId;

    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        organizationId,
      },
    });

    if (!product) {
      throw createError('Product not found', 404);
    }

    const currentStatus = await readTrainStatus(organizationId, productId);
    if (currentStatus?.status === 'running') {
      res.status(202).json(currentStatus);
      return;
    }

    const startedAt = new Date().toISOString();
    await setTrainStatus({
      status: 'running',
      productId,
      organizationId,
      message: 'Training in progress',
      progress: 10,
      startedAt,
      updatedAt: startedAt,
    });

    // Trigger ML training in background so frontend can poll status
    const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';
    void (async () => {
      try {
        const response = await fetch(`${mlServiceUrl}/train`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            productId,
            organizationId,
          }),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          const failedAt = new Date().toISOString();
          await setTrainStatus({
            status: 'failed',
            productId,
            organizationId,
            message: 'Training failed in ML service',
            progress: 100,
            startedAt,
            completedAt: failedAt,
            error: errorBody || `ML service returned ${response.status}`,
            updatedAt: failedAt,
          });
          return;
        }

        const result = await response.json() as { modelType?: string };
        const completedAt = new Date().toISOString();
        await setTrainStatus({
          status: 'completed',
          productId,
          organizationId,
          message: 'Training completed',
          progress: 100,
          startedAt,
          completedAt,
          modelType: result?.modelType,
          updatedAt: completedAt,
        });
      } catch (error) {
        const failedAt = new Date().toISOString();
        await setTrainStatus({
          status: 'failed',
          productId,
          organizationId,
          message: 'Training request failed',
          progress: 100,
          startedAt,
          completedAt: failedAt,
          error: error instanceof Error ? error.message : 'Unknown error',
          updatedAt: failedAt,
        });
      }
    })();

    res.status(202).json({
      message: 'Training started',
      status: 'running',
      progress: 10,
      productId,
      startedAt,
    });

  } catch (error) {
    next(error);
  }
});

router.get('/train-status/:productId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { productId } = req.params;
    const organizationId = req.user!.organizationId;

    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        organizationId,
      },
    });

    if (!product) {
      throw createError('Product not found', 404);
    }

    const status = await readTrainStatus(organizationId, productId);
    if (status) {
      res.json(status);
      return;
    }

    const latestPrediction = await prisma.prediction.findFirst({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, modelType: true },
    });

    if (latestPrediction) {
      res.json({
        status: 'completed',
        productId,
        organizationId,
        message: 'Predictions are available',
        progress: 100,
        completedAt: latestPrediction.createdAt.toISOString(),
        modelType: latestPrediction.modelType,
        updatedAt: latestPrediction.createdAt.toISOString(),
      });
      return;
    }

    res.json({
      status: 'idle',
      productId,
      organizationId,
      message: 'Model has not been trained yet',
      progress: 0,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// Get dashboard predictions summary
router.get('/dashboard', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { days = '30' } = req.query;
    const daysNum = parseInt(days as string);

    // Get recent predictions across all products
    const predictions = await prisma.prediction.findMany({
      where: {
        product: {
          organizationId: req.user!.organizationId,
        },
        predictedDate: {
          gte: new Date(),
          lte: new Date(Date.now() + daysNum * 24 * 60 * 60 * 1000),
        },
      },
      include: {
        product: true,
      },
      orderBy: { predictedDate: 'asc' },
    });

    // Get alerts
    const alerts = await prisma.alert.findMany({
      where: {
        organizationId: req.user!.organizationId,
        isRead: false,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        product: true,
      },
    });

    res.json({
      predictions: predictions.slice(0, 30),
      alerts,
    });
  } catch (error) {
    next(error);
  }
});

// Get all products with stockout predictions
router.get('/alerts', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { threshold = '14' } = req.query;
    const thresholdDays = parseInt(threshold as string);

    // Get all products with their predictions
    const products = await prisma.product.findMany({
      where: {
        organizationId: req.user!.organizationId,
      },
      include: {
        predictions: {
          where: {
            predictedDate: { gte: new Date() },
          },
          orderBy: { predictedDate: 'asc' },
          take: 90,
        },
      },
    });

    const alerts = [];

    for (const product of products) {
      if (product.predictions.length === 0) continue;

      let cumulativeDemand = product.currentStock;
      let stockoutDate = null;
      let daysUntilStockout = null;

      for (const prediction of product.predictions) {
        cumulativeDemand -= prediction.predictedQty;
        if (cumulativeDemand <= 0) {
          stockoutDate = prediction.predictedDate;
          daysUntilStockout = Math.ceil(
            (prediction.predictedDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );
          break;
        }
      }

      if (daysUntilStockout !== null && daysUntilStockout <= thresholdDays) {
        alerts.push({
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          currentStock: product.currentStock,
          stockoutDate,
          daysUntilStockout,
          severity: daysUntilStockout <= 3 ? 'CRITICAL' : daysUntilStockout <= 7 ? 'WARNING' : 'INFO',
        });
      }
    }

    // Sort by days until stockout
    alerts.sort((a, b) => (a.daysUntilStockout || 0) - (b.daysUntilStockout || 0));

    res.json(alerts);
  } catch (error) {
    next(error);
  }
});

export { router as predictionRouter };
