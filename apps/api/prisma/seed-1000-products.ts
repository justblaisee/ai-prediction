import { PrismaClient } from '@prisma/client';
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

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(seededRandom() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(seededRandom() * (max - min + 1)) + min;
}

// Product name generators
const categories = [
  'Electronics', 'Office Supplies', 'Accessories', 'Furniture', 
  'Software', 'Networking', 'Storage', 'Peripherals',
  'Cables', 'Tools', 'Safety', 'Cleaning', 'Food & Beverage',
  'Stationery', 'Printing', 'Communication'
];

const productPrefixes = [
  'Wireless', 'USB', 'Digital', 'Premium', 'Professional', 'Basic',
  'Advanced', 'Smart', 'Ultra', 'Compact', 'Portable', 'Fixed',
  'Standard', 'Deluxe', 'Economy', 'High-Performance'
];

const productTypes = [
  'Mouse', 'Keyboard', 'Monitor', 'Cable', 'Hub', 'Adapter',
  'Webcam', 'Microphone', 'Speaker', 'Headset', 'Stand', 'Lamp',
  'Chair', 'Desk', 'Drawer', 'Shelf', 'Laptop', 'Tablet',
  'Phone', 'Router', 'Switch', 'Server', 'Drive', 'SSD',
  'HDD', 'Flash', 'Card', 'Pen', 'Notebook', 'Paper',
  'Toner', 'Ink', 'Label', 'Folder', 'Binder', 'Clips',
  'Tape', 'Scissors', 'Calculator', 'Clock', 'Calendar',
  'Whiteboard', 'Projector', 'Screen', 'Arm', 'Mount'
];

const productSuffixes = [
  'Pro', 'Plus', 'Max', 'Mini', 'Lite', 'XL', 'Small', 'Medium', 'Large',
  'Standard', 'Enhanced', 'Standard', 'V2', 'V3', '2024', '2025',
  'Gen2', 'Gen3', 'Series A', 'Series B', 'Edition', 'Pack of 2', 'Pack of 5', 'Pack of 10'
];

function generateProductName(): string {
  const prefix = seededRandom() > 0.5 ? randomElement(productPrefixes) : '';
  const type = randomElement(productTypes);
  const suffix = seededRandom() > 0.6 ? randomElement(productSuffixes) : '';
  
  return [prefix, type, suffix].filter(Boolean).join(' ');
}

async function main() {
  console.log('Adding 1000 dummy products...');

  const orgId = '00000000-0000-0000-0000-000000000001';

  // Get existing products count
  const existingCount = await prisma.product.count({
    where: { organizationId: orgId }
  });
  console.log(`Existing products: ${existingCount}`);

  const products = [];
  const batchSize = 100;
  const totalNew = 1000;

  for (let i = 0; i < totalNew; i++) {
    const sku = `SKU-${String(1000 + i).padStart(4, '0')}`;
    const category = randomElement(categories);
    const name = generateProductName();
    const currentStock = randomInt(0, 500);
    const minThreshold = randomInt(5, 50);
    const leadTimeDays = randomInt(1, 30);
    const unitPrice = parseFloat((seededRandom() * 500 + 1).toFixed(2));

    products.push({
      id: uuidv4(),
      sku,
      name,
      description: `High quality ${name.toLowerCase()} - ${category}`,
      currentStock,
      minThreshold,
      leadTimeDays,
      unitPrice,
      category,
      organizationId: orgId,
    });

    // Insert in batches
    if (products.length >= batchSize) {
      await prisma.product.createMany({
        data: products,
        skipDuplicates: true
      });
      console.log(`Inserted ${products.length} products...`);
      products.length = 0;
    }
  }

  // Insert remaining products
  if (products.length > 0) {
    await prisma.product.createMany({
      data: products,
      skipDuplicates: true
    });
    console.log(`Inserted ${products.length} products...`);
  }

  // Create transactions for all products (past 90 days)
  const allProducts = await prisma.product.findMany({
    where: { organizationId: orgId }
  });
  console.log(`Total products now: ${allProducts.length}`);

  console.log('Creating transactions for new products...');
  
  const transactionTypes = ['SALE', 'PURCHASE', 'RETURN', 'ADJUSTMENT'] as const;
  let transactionCount = 0;

  for (let day = 0; day < 90; day++) {
    const date = new Date();
    date.setDate(date.getDate() - day);
    
    // Each day, 50% of products have transactions
    for (const product of allProducts) {
      if (seededRandom() > 0.5) {
        const type = randomElement([...transactionTypes]);
        const quantity = randomInt(1, 50);
        
        await prisma.transaction.create({
          data: {
            date,
            type,
            quantity,
            unitPrice: Number(product.unitPrice),
            promoFlag: seededRandom() > 0.8,
            productId: product.id,
            organizationId: orgId,
          }
        });
        transactionCount++;
      }
    }
    
    if (day % 10 === 0) {
      console.log(`Processed transactions for day ${day}...`);
    }
  }

  console.log(`Created ${transactionCount} transactions`);

  // Create alerts for low stock products
  console.log('Creating alerts for low stock products...');
  const lowStockProducts = allProducts.filter((p: { currentStock: number; minThreshold: number }) => p.currentStock <= p.minThreshold);
  
  for (const product of lowStockProducts) {
    await prisma.alert.create({
      data: {
        type: product.currentStock === 0 ? 'STOCKOUT' : 'LOW_STOCK',
        severity: product.currentStock === 0 ? 'CRITICAL' : 'WARNING',
        message: product.currentStock === 0 
          ? `Product ${product.name} (${product.sku}) is out of stock!`
          : `Product ${product.name} (${product.sku}) is running low (${product.currentStock} units)`,
        productId: product.id,
        organizationId: orgId,
      }
    });
  }
  console.log(`Created ${lowStockProducts.length} alerts`);

  console.log('✅ Successfully added 1000 products with transactions and alerts!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
