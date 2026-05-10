import * as bcrypt from "bcryptjs";
import { prisma } from "../prisma";

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || "admin@achievers.com";
  const password = process.env.SEED_ADMIN_PASSWORD || "Admin@123";
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role: "SUPER_ADMIN",
      tempActivationCodeHash: null,
      tempCodeExpiry: null,
    },
    create: {
      email,
      passwordHash,
      role: "SUPER_ADMIN",
    },
  });

  console.log("Admin seed completed.");
  console.log(`Email: ${email}`);
}

main()
  .catch((error) => {
    console.error("Admin seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
