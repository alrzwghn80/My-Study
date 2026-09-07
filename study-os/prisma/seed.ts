// One-time setup for the single user this app is built for. Run with
// `npx tsx prisma/seed.ts`. Safe to re-run — every write is an upsert.
import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "@/server/db/client";

const DEFAULT_CATEGORIES: { name: string; color: string }[] = [
  { name: "Grammar", color: "#2f6f4f" },
  { name: "Vocabulary", color: "#3f7fb0" },
  { name: "Listening", color: "#9a6fb0" },
  { name: "Reading", color: "#b0813f" },
  { name: "Writing", color: "#b0533f" },
  { name: "Speaking", color: "#3fb094" },
  { name: "Pronunciation", color: "#b03f8e" },
  { name: "Exam Preparation", color: "#5b5fb0" },
  { name: "Reading/Book", color: "#7a8f3f" },
  { name: "German Series/Media", color: "#b0743f" },
  { name: "Review", color: "#6b6b64" },
  { name: "Other", color: "#9a9a92" },
];

async function main() {
  const email = process.env.SEED_USER_EMAIL;
  const password = process.env.SEED_USER_PASSWORD;
  if (!email || !password) {
    throw new Error("SEED_USER_EMAIL and SEED_USER_PASSWORD must be set (see .env.example).");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: {
      email,
      passwordHash,
      settings: { create: { timezone: "UTC" } },
    },
  });

  await prisma.settings.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id, timezone: "UTC" },
  });

  for (const [i, category] of DEFAULT_CATEGORIES.entries()) {
    await prisma.category.upsert({
      where: { userId_name: { userId: user.id, name: category.name } },
      update: {},
      create: { userId: user.id, name: category.name, color: category.color, sortOrder: i },
    });
  }

  console.log(`Seeded user ${user.email} (${user.id}) with ${DEFAULT_CATEGORIES.length} categories.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
