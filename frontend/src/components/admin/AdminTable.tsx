import type { ReactNode } from "react";

type AdminTableProps = {
  headers: string[];
  children: ReactNode;
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyMessage?: string;
};

export function AdminTable({
  headers,
  children,
  loading = false,
  error = null,
  empty = false,
  emptyMessage = "No data found.",
}: AdminTableProps) {
  const colSpan = headers.length;

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-zinc-800 text-left text-sm">
          <thead className="bg-zinc-900 text-xs uppercase tracking-[0.12em] text-zinc-500">
            <tr>
              {headers.map((header) => (
                <th key={header} scope="col" className="px-4 py-3 font-semibold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {loading && (
              <tr>
                <td colSpan={colSpan} className="px-4 py-6 text-zinc-400">
                  Loading...
                </td>
              </tr>
            )}

            {!loading && error && (
              <tr>
                <td colSpan={colSpan} className="px-4 py-6 text-red-300">
                  {error}
                </td>
              </tr>
            )}

            {!loading && !error && empty && (
              <tr>
                <td colSpan={colSpan} className="px-4 py-6 text-zinc-400">
                  {emptyMessage}
                </td>
              </tr>
            )}

            {!loading && !error && !empty && children}
          </tbody>
        </table>
      </div>
    </div>
  );
}
