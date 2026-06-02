"use client";

import { useState, type FormEvent } from "react";
import { cn } from "@/lib/utils";

type SearchBoxProps = {
  onSearch: (keyword: string) => void;
  initialValue?: string;
  loading?: boolean;
  className?: string;
};

export function SearchBox({
  onSearch,
  initialValue = "",
  loading = false,
  className,
}: SearchBoxProps) {
  const [keyword, setKeyword] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedKeyword = keyword.trim();

    if (trimmedKeyword.length < 2) {
      setError("Please enter at least 2 characters.");
      return;
    }

    setError(null);
    onSearch(trimmedKeyword);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-r from-zinc-950 via-zinc-900/60 to-black p-5 shadow-xl",
        className,
      )}
      noValidate
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.03),transparent_40%)]" />
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center">
        <label htmlFor="search" className="sr-only">
          Search songs, artists, albums
        </label>
        <input
          id="search"
          name="q"
          type="search"
          minLength={2}
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="Search songs, artists..."
          className="min-w-0 flex-1 rounded-full border border-zinc-800 bg-black/60 px-5 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-green-500/70 focus:bg-black focus:ring-1 focus:ring-green-500/30"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-green-500 px-6 py-3 text-xs font-bold text-green-950 transition hover:bg-green-400 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500 shadow-md shadow-green-500/10"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {error && <p className="mt-2 text-xs font-semibold text-red-400 pl-4">{error}</p>}
    </form>
  );
}
