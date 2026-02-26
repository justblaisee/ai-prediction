import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

// Seeded Random Number Generator (Linear Congruential Generator)
// Using a fixed seed ensures reproducible data every time the seed runs
const SEED = 42;
let currentSeed = SEED;

function seededRandom(): number {
  // LCG algorithm: a = 16807, m = 2^31 - 1 (Mersenne prime)
  currentSeed = (currentSeed * 16807) % 2147483647;
  return (currentSeed - 1) / 2147483646;
}

async function main() {
  console.log('Starting database seed...');

  // Create default organization
  const org = await prisma.organization.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: process.env.DEFAULT_ORG || 'Acme Corp',
    },
  });
  console.log(`Organization created: ${org.name}`);

  // Create admin user
  const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'StartUp123!', 12);
  
  const admin = await prisma.user.upsert({
    where: { 
      email_organizationId: {
        email: process.env.ADMIN_EMAIL || 'admin@startup.test',
        organizationId: org.id,
      }
    },
    update: {},
    create: {
      id: uuidv4(),
      email: process.env.ADMIN_EMAIL || 'admin@startup.test',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      organizationId: org.id,
    },
  });
  console.log(`Admin user created: ${admin.email}`);

  // Create sample products
  const products = [
    { sku: 'SKU-001', name: 'Wireless Mouse', description: 'Ergonomic wireless mouse', currentStock: 150, minThreshold: 20, leadTimeDays: 7, unitPrice: 29.99, category: 'Electronics' },
    { sku: 'SKU-002', name: 'Mechanical Keyboard', description: 'RGB mechanical keyboard', currentStock: 45, minThreshold: 15, leadTimeDays: 10, unitPrice: 89.99, category: 'Electronics' },
    { sku: 'SKU-003', name: 'USB-C Cable', description: 'Fast charging USB-C cable', currentStock: 500, minThreshold: 100, leadTimeDays: 5, unitPrice: 12.99, category: 'Accessories' },
    { sku: 'SKU-004', name: 'Laptop Stand', description: 'Adjustable aluminum laptop stand', currentStock: 8, minThreshold: 10, leadTimeDays: 14, unitPrice: 49.99, category: 'Accessories' },
    { sku: 'SKU-005', name: 'Webcam HD', description: '1080p HD webcam with microphone', currentStock: 0, minThreshold: 5, leadTimeDays: 21, unitPrice: 69.99, category: 'Electronics' },
    { sku: 'SKU-006', name: 'Monitor 27"', description: '27" 4K UHD monitor', currentStock: 25, minThreshold: 8, leadTimeDays: 14, unitPrice: 399.99, category: 'Electronics' },
    { sku: 'SKU-007', name: 'Desk Lamp', description: 'LED desk lamp with dimmer', currentStock: 60, minThreshold: 15, leadTimeDays: 7, unitPrice: 34.99, category: 'Office' },
    { sku: 'SKU-008', name: 'Notebook Pack', description: 'Pack of 5 ruled notebooks', currentStock: 200, minThreshold: 50, leadTimeDays: 3, unitPrice: 15.99, category: 'Office Supplies' },
    { sku: 'SKU-009', name: 'Pen Set', description: 'Premium ballpoint pen set', currentStock: 75, minThreshold: 25, leadTimeDays: 5, unitPrice: 19.99, category: 'Office Supplies' },
    { sku: 'SKU-010', name: 'Headphones', description: 'Noise-cancelling headphones', currentStock: 12, minThreshold: 10, leadTimeDays: 12, unitPrice: 199.99, category: 'Electronics' },
  ];

  for (const product of products) {
    const created = await prisma.product.upsert({
      where: {
        sku_organizationId: {
          sku: product.sku,
          organizationId: org.id,
        },
      },
      update: {},
      create: {
        id: uuidv4(),
        ...product,
        organizationId: org.id,
      },
    });
    console.log(`Product created: ${created.name}`);
  }

  // Create sample transactions for the past 90 days
  const allProducts = await prisma.product.findMany({
    where: { organizationId: org.id },
  });

  const transactionTypes = ['SALE', 'PURCHASE', 'RETURN'] as const;
  
  for (let i = 0; i < 90; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    for (const product of allProducts) {
      // Random transaction generation with some patterns
      const rand = seededRandom();
      if (rand > 0.3) { // 70% chance of having a transaction
        const type = rand > 0.8 ? 'PURCHASE' : (rand > 0.9 ? 'RETURN' : 'SALE');
        const quantity = Math.floor(seededRandom() * 20) + 1;
        const promoFlag = seededRandom() > 0.85; // 15% promotional
        
        await prisma.transaction.create({
          data: {
            date,
            type,
            quantity,
            unitPrice: Number(product.unitPrice),
            promoFlag,
            productId: product.id,
            organizationId: org.id,
          },
        });
      }
    }
  }
  console.log('Sample transactions created');

  // Create sample alerts
  for (const product of allProducts) {
    if (product.currentStock <= product.minThreshold) {
      await prisma.alert.create({
        data: {
          type: product.currentStock === 0 ? 'STOCKOUT' : 'LOW_STOCK',
          severity: product.currentStock === 0 ? 'CRITICAL' : 'WARNING',
          message: product.currentStock === 0 
            ? `Product ${product.name} (${product.sku}) is out of stock!`
            : `Product ${product.name} (${product.sku}) is running low (${product.currentStock} units)`,
          productId: product.id,
          organizationId: org.id,
        },
      });
    }
  }
  console.log('Sample alerts created');

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
