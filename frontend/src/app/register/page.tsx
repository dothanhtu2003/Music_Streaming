import { AuthForm } from "@/components/ui/AuthForm";

const waveformBars = [
  34, 62, 48, 84, 56, 74, 44, 94, 66, 52, 80, 58, 72, 46, 88, 54, 68,
  42, 78, 60, 86, 50,
];

export default function RegisterPage() {
  return (
    <div className="relative isolate -mx-4 -my-6 flex min-h-screen items-center justify-center overflow-hidden bg-black px-4 py-10 sm:-mx-6 lg:-mx-8">
      {/* Background Cyber Gradients */}
      <div
        className="absolute inset-0 -z-20"
        style={{
          background:
            "radial-gradient(circle at top, #2b053b 0%, transparent 35%), linear-gradient(135deg, #050505 0%, #0b0b0d 44%, #031316 100%)",
        }}
      />
      <div
        className="absolute inset-0 -z-10 opacity-35"
        style={{
          backgroundImage:
            "linear-gradient(rgba(168,85,247,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(168,85,247,0.06) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div className="absolute left-1/2 top-16 -z-10 h-56 w-56 -translate-x-1/2 rounded-full bg-purple-500/20 blur-3xl" />

      <div className="grid w-full max-w-5xl items-center gap-8 lg:grid-cols-2">
        {/* Left Column: Visual Brand Intro */}
        <section className="mx-auto max-w-xl text-center lg:text-left">
          {/* Logo with Equalizer Bars */}
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-purple-400/30 bg-purple-600 text-white shadow-2xl shadow-purple-500/25 lg:mx-0">
            <span className="flex h-7 items-end gap-1" aria-hidden="true">
              <span className="h-3 w-1.5 rounded-full bg-white/90" />
              <span className="h-5 w-1.5 rounded-full bg-white/90" />
              <span className="h-7 w-1.5 rounded-full bg-white/90" />
              <span className="h-4 w-1.5 rounded-full bg-white/90" />
            </span>
          </div>

          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-purple-300">
            Music Streaming
          </p>
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl leading-tight">
            Join the sound <br />
            <span className="bg-gradient-to-r from-purple-400 via-pink-500 to-orange-500 bg-clip-text text-transparent">revolution.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-zinc-300 sm:text-base lg:mx-0">
            Create your profile to upload original tracks, curate playlists, comment on your favorite beats, and connect with global artists.
          </p>

          {/* Queue Waveform Preview Card */}
          <div className="mt-8 hidden rounded-2xl border border-white/10 bg-white/5 p-4 shadow-2xl shadow-black/40 backdrop-blur md:block">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 font-mono">
                  Synthesizer active
                </p>
                <p className="mt-1 text-sm font-bold text-white">
                  Rave Waveform Engine v1.0
                </p>
              </div>
              <div className="rounded-full bg-purple-500/15 px-3 py-1 text-xs font-bold text-purple-300 font-mono">
                Online
              </div>
            </div>
            <div className="flex h-20 items-end gap-1.5 overflow-hidden rounded-xl bg-black/30 px-3 py-3">
              {waveformBars.map((height, index) => (
                <span
                  aria-hidden="true"
                  className="flex-1 rounded-full bg-gradient-to-t from-purple-600 to-pink-400 opacity-90"
                  key={`${height}-${index}`}
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Right Column: Register Form */}
        <AuthForm mode="register" />
      </div>
    </div>
  );
}
