import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

if (!process.env.DATABASE_URL_TEST) {
  throw new Error(
    "DATABASE_URL_TEST is not set. Integration tests run against a disposable database — see docs/testing.md and README.md.",
  );
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL_TEST });
export const testDb = new PrismaClient({ adapter });

/** Creates a throwaway user (+ default Settings) for one test. Delete it in the test's finally block. */
export async function createTestUser(overrides: { timezone?: string } = {}) {
  const email = `test-${randomUUID()}@example.com`;
  const user = await testDb.user.create({
    data: {
      email,
      passwordHash: "test",
      settings: { create: { timezone: overrides.timezone ?? "UTC" } },
    },
  });
  return user;
}

export async function deleteTestUser(userId: string) {
  await testDb.user.delete({ where: { id: userId } }).catch(() => {
    // Already gone (e.g. a test that deleted it itself) — fine.
  });
}

export async function createTestCategory(userId: string, name = "Grammar") {
  return testDb.category.create({ data: { userId, name, color: "#3366ff" } });
}
