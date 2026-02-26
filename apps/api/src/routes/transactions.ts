import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { createError } from '../middleware/errorHandler';
import { AuthRequest, authenticate } from '../middleware/auth';

const router = Router();

const transactionSchema = z.object({
  date: z.string().datetime(),
  type: z.enum(['SALE', 'PURCHASE', 'ADJUSTMENT', 'RETURN']),
  quantity: z.number().int(),
  unitPrice: z.number().positive(),
  promoFlag: z.boolean().default(false),
  notes: z.string().optional(),
  productId: z.string().uuid(),
});

const bulkTransactionSchema = z.array(transactionSchema);

// Get all transactions
router.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '50', productId, startDate, endDate, type } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: any = {
      organizationId: req.user!.organizationId,
    };

    if (productId) {
      where.productId = productId;
    }

    if (type) {
      where.type = type;
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate as string);
      if (endDate) where.date.lte = new Date(endDate as string);
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take,
        orderBy: { date: 'desc' },
        include: {
          product: {
            select: { id: true, sku: true, name: true },
          },
        },
      }),
      prisma.transaction.count({ where }),
    ]);

    res.json({
      transactions,
      pagination: {
        page: parseInt(page as string),
        limit: take,
        total,
        pages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Create single transaction
router.post('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = transactionSchema.parse(req.body);

    // Verify product belongs to organization
    const product = await prisma.product.findFirst({
      where: {
        id: data.productId,
        organizationId: req.user!.organizationId,
      },
    });

    if (!product) {
      throw createError('Product not found', 404);
    }

    const transaction = await prisma.transaction.create({
      data: {
        ...data,
        date: new Date(data.date),
        organizationId: req.user!.organizationId,
      },
      include: { product: true },
    });

    // Update product stock
    let stockChange = 0;
    switch (data.type) {
      case 'SALE':
      case 'RETURN':
        stockChange = data.quantity;
        break;
      case 'PURCHASE':
      case 'ADJUSTMENT':
        stockChange = data.quantity;
        break;
    }

    // For sales, we reduce stock; for purchases, we increase
    if (data.type === 'SALE') {
      await prisma.product.update({
        where: { id: data.productId },
        data: { currentStock: { decrement: data.quantity } },
      });
    } else if (data.type === 'PURCHASE') {
      await prisma.product.update({
        where: { id: data.productId },
        data: { currentStock: { increment: data.quantity } },
      });
    }

    // Check for low stock alert
    const updatedProduct = await prisma.product.findUnique({
      where: { id: data.productId },
    });

    if (updatedProduct && updatedProduct.currentStock <= updatedProduct.minThreshold) {
      await prisma.alert.create({
        data: {
          type: 'LOW_STOCK',
          severity: updatedProduct.currentStock === 0 ? 'CRITICAL' : 'WARNING',
          message: `Low stock alert: ${product.name} (${product.sku}) has only ${updatedProduct.currentStock} units left`,
          productId: data.productId,
          organizationId: req.user!.organizationId,
        },
      });
    }

    res.status(201).json(transaction);
  } catch (error) {
    next(error);
  }
});

// Bulk create transactions (CSV upload)
router.post('/bulk', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = bulkTransactionSchema.parse(req.body);

    // Verify all products belong to organization
    const productIds = [...new Set(data.map(t => t.productId))];
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        organizationId: req.user!.organizationId,
      },
    });

    if (products.length !== productIds.length) {
      throw createError('One or more products not found', 400);
    }

    const transactions = await prisma.$transaction(
      data.map(t => 
        prisma.transaction.create({
          data: {
            ...t,
            date: new Date(t.date),
            organizationId: req.user!.organizationId,
          },
        })
      )
    );

    res.status(201).json({
      message: `Successfully created ${transactions.length} transactions`,
      transactions,
    });
  } catch (error) {
    next(error);
  }
});

// Get transaction summary
router.get('/summary', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = req.query;
    
    const where: any = {
      organizationId: req.user!.organizationId,
    };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate as string);
      if (endDate) where.date.lte = new Date(endDate as string);
    }

    const [summary] = await prisma.transaction.groupBy({
      by: ['type'],
      where,
      _sum: {
        quantity: true,
      },
      _count: true,
    });

    res.json(summary);
  } catch (error) {
    next(error);
  }
});

export { router as transactionRouter };
