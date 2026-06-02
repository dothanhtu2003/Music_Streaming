import type { PlaylistFormPayload } from "@/components/playlist/PlaylistProvider";

export const emptyPlaylistFormValue: PlaylistFormPayload = {
  title: "",
  description: "",
  coverUrl: "",
  isPublic: true,
};

type PlaylistFormProps = {
  form: PlaylistFormPayload;
  onChange: (form: PlaylistFormPayload) => void;
};

export function PlaylistForm({ form, onChange }: PlaylistFormProps) {
  const updateForm = (
    key: keyof PlaylistFormPayload,
    value: string | boolean,
  ) => {
    onChange({
      ...form,
      [key]: value,
    });
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <label className="block text-sm font-medium text-zinc-300">
        Title
        <input
          value={form.title}
          onChange={(event) => updateForm("title", event.target.value)}
          maxLength={150}
          className="mt-2 w-full rounded-lg border border-zinc-800 bg-black px-3 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-green-500"
          placeholder="My Favorite Set"
        />
      </label>

      <label className="block text-sm font-medium text-zinc-300">
        Cover URL
        <input
          value={form.coverUrl}
          onChange={(event) => updateForm("coverUrl", event.target.value)}
          maxLength={1000}
          className="mt-2 w-full rounded-lg border border-zinc-800 bg-black px-3 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-green-500"
          placeholder="Optional"
        />
      </label>

      <label className="block text-sm font-medium text-zinc-300 md:col-span-2">
        Description
        <textarea
          value={form.description}
          onChange={(event) => updateForm("description", event.target.value)}
          rows={4}
          maxLength={5000}
          className="mt-2 w-full resize-none rounded-lg border border-zinc-800 bg-black px-3 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-green-500"
          placeholder="Short note about this set"
        />
      </label>

      <label className="flex items-center gap-2 text-sm text-zinc-400">
        <input
          type="checkbox"
          checked={Boolean(form.isPublic)}
          onChange={(event) => updateForm("isPublic", event.target.checked)}
          className="accent-green-500"
        />
        Public playlist
      </label>
    </div>
  );
}
