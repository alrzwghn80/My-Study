"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db/client";
import { requireUserId, toActionError } from "./helpers";
import type { ActionResult } from "./timer";

function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}
function fail<T>(e: unknown): ActionResult<T> {
  return { ok: false, error: toActionError(e) };
}

export async function createCategoryAction(name: string, color: string): Promise<ActionResult<{ id: string }>> {
  try {
    const userId = await requireUserId();
    const trimmed = name.trim();
    if (!trimmed) throw new RangeError("Category name is required");
    const count = await prisma.category.count({ where: { userId } });
    const category = await prisma.category.create({
      data: { userId, name: trimmed, color, sortOrder: count },
    });
    revalidatePath("/settings");
    return ok({ id: category.id });
  } catch (e) {
    return fail(e);
  }
}

export async function renameCategoryAction(categoryId: string, name: string): Promise<ActionResult<null>> {
  try {
    const userId = await requireUserId();
    const trimmed = name.trim();
    if (!trimmed) throw new RangeError("Category name is required");
    const existing = await prisma.category.findFirst({ where: { id: categoryId, userId } });
    if (!existing) throw new Error("Category not found");
    await prisma.category.update({ where: { id: categoryId }, data: { name: trimmed } });
    revalidatePath("/settings");
    return ok(null);
  } catch (e) {
    return fail(e);
  }
}

export async function recolorCategoryAction(categoryId: string, color: string): Promise<ActionResult<null>> {
  try {
    const userId = await requireUserId();
    const existing = await prisma.category.findFirst({ where: { id: categoryId, userId } });
    if (!existing) throw new Error("Category not found");
    await prisma.category.update({ where: { id: categoryId }, data: { color } });
    revalidatePath("/settings");
    return ok(null);
  } catch (e) {
    return fail(e);
  }
}

/** Categories are never deleted (would corrupt historical statistics) — only archived. */
export async function setCategoryArchivedAction(categoryId: string, isArchived: boolean): Promise<ActionResult<null>> {
  try {
    const userId = await requireUserId();
    const existing = await prisma.category.findFirst({ where: { id: categoryId, userId } });
    if (!existing) throw new Error("Category not found");
    await prisma.category.update({ where: { id: categoryId }, data: { isArchived } });
    revalidatePath("/settings");
    return ok(null);
  } catch (e) {
    return fail(e);
  }
}
