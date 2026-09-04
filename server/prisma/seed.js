import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const hash = await bcrypt.hash('ChangeMe123!', 10);

const user = await prisma.user.upsert({
  where: {
    email: 'admin@ojat.local',
  },
  update: {
    passwordHash: hash,
  },
  create: {
    email: 'admin@ojat.local',
    passwordHash: hash,
    firstName: 'Platform',
    lastName: 'Admin',
    role: 'PLATFORM_ADMIN',
  },
});

const business = await prisma.business.upsert({
  where: {
    slug: 'demo-fashion-store',
  },
  update: {},
  create: {
    name: 'Demo Fashion Store',
    slug: 'demo-fashion-store',
  },
});

await prisma.businessMember.upsert({
  where: {
    businessId_userId: {
      businessId: business.id,
      userId: user.id,
    },
  },
  update: {},
  create: {
    businessId: business.id,
    userId: user.id,
    role: 'BUSINESS_OWNER',
  },
});

const p = await prisma.product.upsert({
  where: {
    businessId_sku: {
      businessId: business.id,
      sku: 'RED-SHOE-42',
    },
  },
  update: {},
  create: {
    businessId: business.id,
    name: 'Red Shoe',
    sku: 'RED-SHOE-42',
    sellingPrice: 42500,
    minStock: 3,
  },
});

await prisma.inventory.upsert({
  where: {
    productId: p.id,
  },
  update: {
    quantity: 10,
  },
  create: {
    businessId: business.id,
    productId: p.id,
    quantity: 10,
  },
});

console.log(
  'Seed complete. Login: admin@ojat.local / ChangeMe123!'
);

await prisma.$disconnect();
