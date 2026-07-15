// Run with: npx tsx prisma/seed.ts  (or node --loader ts-node/esm prisma/seed.ts)
// Creates one store and one owner user so you can log in immediately.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const store = await prisma.store.create({
    data: {
      name: "Sharma General Store",
      address: "Main Market, Sector 12",
      whatsappMode: "MANUAL",
    },
  });

  const passwordHash = await bcrypt.hash("changeme123", 10);

  const owner = await prisma.user.create({
    data: {
      storeId: store.id,
      name: "Owner",
      phone: "+919800000000",
      passwordHash,
      role: "OWNER",
      canViewPricing: true,
      canViewContactDetails: true,
    },
  });

  const helper = await prisma.user.create({
    data: {
      storeId: store.id,
      name: "Helper",
      phone: "+919800000001",
      passwordHash,
      role: "HELPER",
      canViewPricing: false,
      canViewContactDetails: false,
    },
  });

  console.log("Seeded store:", store.id);
  console.log("Owner login -> phone: +919800000000, password: changeme123");
  console.log("Helper login -> phone: +919800000001, password: changeme123");
  console.log("\nSet your Telegram bot token on this store with:");
  console.log(
    `  UPDATE "Store" SET "telegramBotToken" = 'YOUR_TOKEN' WHERE id = '${store.id}';`
  );
  console.log("Then register the webhook (see README) using this storeId:", store.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
