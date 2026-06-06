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
        "relative w-full",
        className,
      )}
      noValidate
    >
      <div className="relative flex items-center">
        {/* Search icon inside input */}
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-zinc-500">
          <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          id="search"
          name="q"
          type="search"
          minLength={2}
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="Search tracks, artists..."
          className="w-full rounded-full border border-zinc-800 bg-zinc-900/40 backdrop-blur-md py-2.5 pl-11 pr-24 text-xs text-white outline-none transition placeholder:text-zinc-500 focus:border-orange-500/60 focus:bg-zinc-900/80 focus:ring-1 focus:ring-orange-500/20"
        />
        <button
          type="submit"
          disabled={loading}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-orange-500 px-4 py-1.5 text-[10px] font-bold text-orange-950 transition hover:bg-orange-400 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500 shadow-md shadow-orange-500/10"
        >
          {loading ? "..." : "Search"}
        </button>
      </div>

      {error && <p className="absolute top-full left-4 mt-1 text-[10px] font-semibold text-red-400">{error}</p>}
    </form>
  );
}
