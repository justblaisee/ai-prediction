import { Router, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { createError } from '../middleware/errorHandler';
import { AuthRequest, authenticate } from '../middleware/auth';

const router = Router();

// Get all alerts for organization
router.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '20', unread, type, severity } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: any = {
      organizationId: req.user!.organizationId,
    };

    if (unread === 'true') {
      where.isRead = false;
    }

    if (type) {
      where.type = type;
    }

    if (severity) {
      where.severity = severity;
    }

    const [alerts, total, unreadCount] = await Promise.all([
      prisma.alert.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          product: {
            select: { id: true, sku: true, name: true },
          },
        },
      }),
      prisma.alert.count({ where }),
      prisma.alert.count({
        where: {
          organizationId: req.user!.organizationId,
          isRead: false,
        },
      }),
    ]);

    res.json({
      alerts,
      unreadCount,
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

// Mark alert as read
router.patch('/:id/read', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const alert = await prisma.alert.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.user!.organizationId,
      },
    });

    if (!alert) {
      throw createError('Alert not found', 404);
    }

    const updated = await prisma.alert.update({
      where: { id: req.params.id },
      data: { isRead: true },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// Mark all alerts as read
router.post('/read-all', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.alert.updateMany({
      where: {
        organizationId: req.user!.organizationId,
        isRead: false,
      },
      data: { isRead: true },
    });

    res.json({ message: 'All alerts marked as read' });
  } catch (error) {
    next(error);
  }
});

// Delete alert
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const alert = await prisma.alert.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.user!.organizationId,
      },
    });

    if (!alert) {
      throw createError('Alert not found', 404);
    }

    await prisma.alert.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Alert deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Get alert statistics
router.get('/stats', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [total, unread, byType, bySeverity] = await Promise.all([
      prisma.alert.count({
        where: { organizationId: req.user!.organizationId },
      }),
      prisma.alert.count({
        where: { organizationId: req.user!.organizationId, isRead: false },
      }),
      prisma.alert.groupBy({
        by: ['type'],
        where: { organizationId: req.user!.organizationId },
        _count: true,
      }),
      prisma.alert.groupBy({
        by: ['severity'],
        where: { organizationId: req.user!.organizationId },
        _count: true,
      }),
    ]);

    res.json({
      total,
      unread,
      byType: byType.reduce((acc: Record<string, number>, curr: { type: string; _count: number }) => {
        acc[curr.type] = curr._count;
        return acc;
      }, {} as Record<string, number>),
      bySeverity: bySeverity.reduce((acc: Record<string, number>, curr: { severity: string; _count: number }) => {
        acc[curr.severity] = curr._count;
        return acc;
      }, {} as Record<string, number>),

    });
  } catch (error) {
    next(error);
  }
});

export { router as alertRouter };
