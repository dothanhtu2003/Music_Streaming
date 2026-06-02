"use client";

import { useState, type FormEvent } from "react";

type SearchBoxProps = {
  onSearch: (keyword: string) => void;
  initialValue?: string;
  loading?: boolean;
};

export function SearchBox({
  onSearch,
  initialValue = "",
  loading = false,
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
      className="rounded-lg border border-zinc-800 bg-zinc-950 p-4"
      noValidate
    >
      <div className="flex flex-col gap-3 sm:flex-row">
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
          placeholder="Search songs, artists, albums..."
          className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-green-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-green-500 px-5 py-3 text-sm font-semibold text-green-950 transition hover:bg-green-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
    </form>
  );
}
