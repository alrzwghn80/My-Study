"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db/client";
import { exportUserData, importUserData, toCsv, type ImportSummary } from "@/server/domain/export-import";
import { requireUserId, toActionError } from "./helpers";
import type { ActionResult } from "./timer";

function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}
function fail<T>(e: unknown): ActionResult<T> {
  return { ok: false, error: toActionError(e) };
}

export async function exportJsonAction(): Promise<ActionResult<string>> {
  try {
    const userId = await requireUserId();
    const backup = await exportUserData(prisma, userId);
    return ok(JSON.stringify(backup, null, 2));
  } catch (e) {
    return fail(e);
  }
}

export async function exportCsvAction(): Promise<ActionResult<string>> {
  try {
    const userId = await requireUserId();
    const backup = await exportUserData(prisma, userId);
    const categoryNameById = new Map(backup.categories.map((c) => [c.id, c.name]));
    return ok(toCsv(backup.sessions, categoryNameById));
  } catch (e) {
    return fail(e);
  }
}

export async function importJsonAction(fileContents: string): Promise<ActionResult<ImportSummary>> {
  try {
    const userId = await requireUserId();
    let parsed: unknown;
    try {
      parsed = JSON.parse(fileContents);
    } catch {
      throw new Error("That file isn't valid JSON.");
    }
    const summary = await importUserData(prisma, userId, parsed);
    revalidatePath("/", "layout");
    return ok(summary);
  } catch (e) {
    return fail(e);
  }
}
