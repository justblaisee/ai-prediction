import { Router, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { createError } from '../middleware/errorHandler';
import { AuthRequest, authenticate } from '../middleware/auth';

const router = Router();

// Get all products for organization
router.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '20', search, category, status } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: any = {
      organizationId: req.user!.organizationId,
    };

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { sku: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    if (category) {
      where.category = category;
    }

    if (status) {
      where.status = status;
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { predictions: true, transactions: true },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      products,
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

// Get single product
router.get('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const product = await prisma.product.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.user!.organizationId,
      },
      include: {
        predictions: {
          where: {
            predictedDate: { gte: new Date() },
          },
          orderBy: { predictedDate: 'asc' },
          take: 30,
        },
        transactions: {
          orderBy: { date: 'desc' },
          take: 10,
        },
      },
    });

    if (!product) {
      throw createError('Product not found', 404);
    }

    res.json(product);
  } catch (error) {
    next(error);
  }
});

// Create product
router.post('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = req.body;

    // Check if SKU already exists
    const existing = await prisma.product.findFirst({
      where: {
        sku: data.sku,
        organizationId: req.user!.organizationId,
      },
    });

    if (existing) {
      throw createError('SKU already exists', 400);
    }

    const product = await prisma.product.create({
      data: {
        ...data,
        organizationId: req.user!.organizationId,
      },
    });

    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
});

// Update product
router.patch('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = req.body;

    const existing = await prisma.product.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.user!.organizationId,
      },
    });

    if (!existing) {
      throw createError('Product not found', 404);
    }

    // Check SKU uniqueness if being updated
    if (data.sku && data.sku !== existing.sku) {
      const skuExists = await prisma.product.findFirst({
        where: {
          sku: data.sku,
          organizationId: req.user!.organizationId,
          id: { not: req.params.id },
        },
      });

      if (skuExists) {
        throw createError('SKU already exists', 400);
      }
    }

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data,
    });

    res.json(product);
  } catch (error) {
    next(error);
  }
});

// Delete product
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.product.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.user!.organizationId,
      },
    });

    if (!existing) {
      throw createError('Product not found', 404);
    }

    await prisma.product.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Bulk import products
router.post('/bulk', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { products } = req.body;

    if (!Array.isArray(products) || products.length === 0) {
      throw createError('Products array is required', 400);
    }

    // Validate all products have required fields
    for (const p of products) {
      if (!p.sku || !p.name) {
        throw createError('All products must have SKU and name', 400);
      }
    }

    // Get existing SKUs
    const skus = products.map((p: { sku: string }) => p.sku);
    const existing = await prisma.product.findMany({
      where: {
        organizationId: req.user!.organizationId,
        sku: { in: skus },
      },
      select: { sku: true },
    });

    const existingSkus = new Set(existing.map((e: { sku: string }) => e.sku));

    // Separate new and existing
    const toCreate = products.filter((p: { sku: string }) => !existingSkus.has(p.sku));
    const toUpdate = products.filter((p: { sku: string }) => existingSkus.has(p.sku));

    // Create new products
    const created = await prisma.$transaction(
      toCreate.map((p: Record<string, unknown>) =>
        prisma.product.create({
          data: {
            ...p,
            organizationId: req.user!.organizationId,
          } as any,
        })
      )
    );

    // Update existing products
    const updated = await prisma.$transaction(
      toUpdate.map((p: { sku: string } & Record<string, unknown>) =>
        prisma.product.update({
          where: {
            sku_organizationId: {
              sku: p.sku,
              organizationId: req.user!.organizationId,
            },
          },
          data: p as any,
        })
      )
    );

    res.json({
      message: 'Bulk import completed',
      created: created.length,
      updated: updated.length,
      products: [...created, ...updated],
    });
  } catch (error) {
    next(error);
  }
});

// Get product categories
router.get('/categories/all', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const categories = await prisma.product.groupBy({
      by: ['category'],
      where: { organizationId: req.user!.organizationId },
      _count: true,
    });

    res.json(
      categories.map((c: { category: string | null; _count: number }) => ({
        name: c.category || 'Uncategorized',
        count: c._count,
      }))
    );
  } catch (error) {
    next(error);
  }
});

export { router as productRouter };
