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
          onChange={(event) => {
            setKeyword(event.target.value);
            if (error) setError(null);
          }}
          placeholder="Search tracks, artists, playlists..."
          className="w-full rounded-full border border-zinc-800 bg-zinc-900/60 backdrop-blur-md py-2.5 pl-11 pr-20 text-xs text-white outline-none transition placeholder:text-zinc-500 focus:border-orange-500/60 focus:bg-zinc-900/90 focus:ring-1 focus:ring-orange-500/20"
        />
        {keyword.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setKeyword("");
              setError(null);
            }}
            className="absolute right-11 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-400 hover:text-white transition"
            aria-label="Clear search"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 text-orange-950 transition hover:bg-orange-400 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500 shadow-md shadow-orange-500/20"
          aria-label="Search"
        >
          {loading ? (
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-orange-950 border-t-transparent" />
          ) : (
            <svg className="h-3.5 w-3.5 fill-none stroke-current stroke-[2.5]" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
        </button>
      </div>

      {error && <p className="absolute top-full left-4 mt-1 text-[10px] font-semibold text-red-400">{error}</p>}
    </form>
  );
}
