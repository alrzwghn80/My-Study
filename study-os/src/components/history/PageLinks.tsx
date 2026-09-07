import Link from "next/link";

export function PageLinks({ page, hasNextPage }: { page: number; hasNextPage: boolean }) {
  if (page === 1 && !hasNextPage) return null;

  return (
    <div className="flex justify-between pt-4 text-sm">
      {page > 1 ? (
        <Link href={{ pathname: "/history", query: { page: page - 1 } }} className="text-[var(--color-primary)] hover:underline">
          ← Newer
        </Link>
      ) : (
        <span />
      )}
      {hasNextPage && (
        <Link href={{ pathname: "/history", query: { page: page + 1 } }} className="text-[var(--color-primary)] hover:underline">
          Older →
        </Link>
      )}
    </div>
  );
}
