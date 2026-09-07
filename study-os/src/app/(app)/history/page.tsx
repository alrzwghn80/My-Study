import Link from "next/link";
import { requireUserId } from "@/server/actions/helpers";
import { getSessionHistory, getDayDetail } from "@/server/queries/history";
import { prisma } from "@/server/db/client";
import { HistoryFiltersForm } from "@/components/history/HistoryFiltersForm";
import { SessionRow, type SessionRowData } from "@/components/history/SessionRow";
import { DayDetailTimeline } from "@/components/history/DayDetailTimeline";
import { toDateInputValue } from "@/lib/format";
import { todayInTimezone } from "@/server/domain/calendar";

function parseDateParam(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(Date.UTC(y, m - 1, d));
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const userId = await requireUserId();
  const params = await searchParams;

  const settings = await prisma.settings.findUniqueOrThrow({ where: { userId } });
  const categories = await prisma.category.findMany({ where: { userId }, orderBy: { sortOrder: "asc" } });
  const today = todayInTimezone(settings.timezone);
  const todayStr = toDateInputValue(today);

  const dayParam = parseDateParam(params.date);

  if (dayParam) {
    const detail = await getDayDetail(userId, dayParam);
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-[var(--color-text)]">Day Detail</h1>
          <Link href="/history" className="text-sm text-[var(--color-primary)] underline underline-offset-2">
            Back to history
          </Link>
        </div>
        <DayDetailTimeline
          date={dayParam}
          timezone={settings.timezone}
          focusSeconds={detail.focusSeconds}
          breakSeconds={detail.breakSeconds}
          intervals={detail.intervals}
          sessionCount={detail.sessions.length}
        />
        <ul className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4">
          {detail.sessions.map((s) => (
            <SessionRow
              key={s.id}
              today={todayStr}
              categories={categories}
              session={toRowData(s)}
            />
          ))}
        </ul>
      </div>
    );
  }

  const filters = {
    dateFrom: parseDateParam(params.dateFrom),
    dateTo: parseDateParam(params.dateTo),
    categoryId: params.categoryId || undefined,
    source: params.source as "TRACKED" | "MANUAL" | undefined,
    status: params.status as "COMPLETED" | "CANCELLED" | undefined,
    minDurationMinutes: params.minDuration ? Number(params.minDuration) : undefined,
    search: params.search || undefined,
    page: params.page ? Number(params.page) : 1,
  };

  const result = await getSessionHistory(userId, filters);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-[var(--color-text)]">History</h1>

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <HistoryFiltersForm
          categories={categories}
          current={{
            dateFrom: params.dateFrom,
            dateTo: params.dateTo,
            categoryId: params.categoryId,
            source: params.source,
            status: params.status,
            minDuration: params.minDuration,
            search: params.search,
          }}
        />
      </div>

      {result.sessions.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center text-sm text-[var(--color-text-muted)]">
          No study history yet. Start your first German session from the dashboard.
        </div>
      ) : (
        <>
          <ul className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4">
            {result.sessions.map((s) => (
              <SessionRow key={s.id} today={todayStr} categories={categories} session={toRowData(s)} />
            ))}
          </ul>

          {result.totalPages > 1 && (
            <div className="flex justify-center gap-2 text-sm">
              {Array.from({ length: result.totalPages }, (_, i) => i + 1).map((p) => (
                <Link
                  key={p}
                  href={{ pathname: "/history", query: { ...params, page: String(p) } }}
                  className={`rounded-[var(--radius-sm)] px-2.5 py-1 ${p === result.page ? "bg-[var(--color-primary)] text-[var(--color-primary-fg)]" : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]"}`}
                >
                  {p}
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function toRowData(s: {
  id: string;
  createdAt: Date;
  categoryId: string | null;
  category: { name: string; color: string } | null;
  source: string;
  status: string;
  focusSeconds: number;
  breakSeconds: number;
  productivityRating: number | null;
  difficultyRating: number | null;
  notes: string | null;
}): SessionRowData {
  return {
    id: s.id,
    date: s.createdAt,
    categoryId: s.categoryId,
    categoryName: s.category?.name ?? null,
    categoryColor: s.category?.color ?? null,
    source: s.source as "TRACKED" | "MANUAL",
    status: s.status as "COMPLETED" | "CANCELLED",
    focusSeconds: s.focusSeconds,
    breakSeconds: s.breakSeconds,
    productivityRating: s.productivityRating,
    difficultyRating: s.difficultyRating,
    notes: s.notes,
  };
}
