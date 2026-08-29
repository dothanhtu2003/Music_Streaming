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
    <div className="space-y-3">
      <div>
        <label className="block text-[11px] font-extrabold uppercase tracking-wider text-zinc-400 mb-1">
          Playlist Title *
        </label>
        <input
          value={form.title}
          onChange={(event) => updateForm("title", event.target.value)}
          maxLength={150}
          className="w-full rounded-xl border border-zinc-800 bg-zinc-900/90 px-3.5 py-2.5 text-xs sm:text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-orange-500/80 font-medium"
          placeholder="e.g. Chill Vibes, House Party 2026..."
        />
      </div>

      <div>
        <label className="block text-[11px] font-extrabold uppercase tracking-wider text-zinc-400 mb-1">
          Description <span className="text-zinc-500 font-normal lowercase">(optional)</span>
        </label>
        <textarea
          value={form.description}
          onChange={(event) => updateForm("description", event.target.value)}
          rows={2}
          maxLength={5000}
          className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900/90 px-3.5 py-2.5 text-xs text-white outline-none transition placeholder:text-zinc-500 focus:border-orange-500/80 font-medium"
          placeholder="Add a short note about this playlist..."
        />
      </div>

      <div>
        <label className="block text-[11px] font-extrabold uppercase tracking-wider text-zinc-400 mb-1">
          Cover Image URL <span className="text-zinc-500 font-normal lowercase">(optional)</span>
        </label>
        <input
          value={form.coverUrl}
          onChange={(event) => updateForm("coverUrl", event.target.value)}
          maxLength={1000}
          className="w-full rounded-xl border border-zinc-800 bg-zinc-900/90 px-3.5 py-2.5 text-xs text-white outline-none transition placeholder:text-zinc-500 focus:border-orange-500/80 font-medium"
          placeholder="https://..."
        />
      </div>

      <div className="pt-1">
        <label className="inline-flex items-center gap-2.5 text-xs font-semibold text-zinc-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={Boolean(form.isPublic)}
            onChange={(event) => updateForm("isPublic", event.target.checked)}
            className="h-4 w-4 rounded accent-orange-500 cursor-pointer"
          />
          <span>Public Playlist (visible on profile)</span>
        </label>
      </div>
    </div>
  );
}
