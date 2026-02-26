import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

// Simple in-memory metrics (in production, use Prometheus client)
let requestCount = 0;
let errorCount = 0;

router.get('/', async (req: Request, res: Response) => {
  requestCount++;
  
  try {
    // Get some basic metrics
    const [userCount, productCount, transactionCount] = await Promise.all([
      prisma.user.count(),
      prisma.product.count(),
      prisma.transaction.count(),
    ]);

    res.json({
      requests: {
        total: requestCount,
        errors: errorCount,
      },
      database: {
        users: userCount,
        products: productCount,
        transactions: transactionCount,
      },
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    errorCount++;
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

export { router as metricsRouter };
