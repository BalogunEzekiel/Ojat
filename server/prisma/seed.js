import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash(
    "ChangeMe123!",
    12
  );

  const admin = await prisma.user.upsert({
    where: {
      email: "admin@ojat.local",
    },
    update: {
      passwordHash,
      role: UserRole.PLATFORM_ADMIN,
      firstName: "Ojat",
      lastName: "Admin",
    },
    create: {
      email: "admin@ojat.local",
      passwordHash,
      firstName: "Ojat",
      lastName: "Admin",
      role: UserRole.PLATFORM_ADMIN,
    },
  });

  console.log(
    `Platform admin ready: ${admin.email}`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
