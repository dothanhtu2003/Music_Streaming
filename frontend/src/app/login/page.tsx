import { AuthForm } from "@/components/ui/AuthForm";
import { getSafeRedirectPath } from "@/lib/utils";

type LoginPageProps = {
  searchParams: Promise<{
    redirect?: string | string[];
    registered?: string | string[];
  }>;
};

const waveformBars = [
  28, 52, 38, 74, 46, 64, 34, 84, 56, 42, 70, 48, 62, 36, 78, 44, 58,
  32, 68, 50, 76, 40,
];

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const redirectTo = getSafeRedirectPath(params.redirect, "/home");
  const registered = Array.isArray(params.registered)
    ? params.registered[0] === "1"
    : params.registered === "1";

  return (
    <div className="relative isolate -mx-4 -my-6 flex min-h-screen items-center justify-center overflow-hidden bg-black px-4 py-10 sm:-mx-6 lg:-mx-8">
      <div
        className="absolute inset-0 -z-20"
        style={{
          background:
            "radial-gradient(circle at top, #3b1805 0%, transparent 34%), linear-gradient(135deg, #050505 0%, #0b0b0d 44%, #160803 100%)",
        }}
      />
      <div
        className="absolute inset-0 -z-10 opacity-35"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,85,0,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,85,0,0.08) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div className="absolute left-1/2 top-16 -z-10 h-56 w-56 -translate-x-1/2 rounded-full bg-orange-500/20 blur-3xl" />

      <div className="grid w-full max-w-5xl items-center gap-8 lg:grid-cols-2">
        <section className="mx-auto max-w-xl text-center lg:text-left">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-orange-400/30 bg-orange-500 text-black shadow-2xl shadow-orange-500/25 lg:mx-0">
            <span className="flex h-7 items-end gap-1" aria-hidden="true">
              <span className="h-3 w-1.5 rounded-full bg-black/90" />
              <span className="h-6 w-1.5 rounded-full bg-black/90" />
              <span className="h-4 w-1.5 rounded-full bg-black/90" />
              <span className="h-7 w-1.5 rounded-full bg-black/90" />
            </span>
          </div>
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-orange-300">
            Music Streaming
          </p>
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
            Login to your sound space
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-zinc-300 sm:text-base lg:mx-0">
            Sign in to play tracks, save favorites, and continue building your
            personal library.
          </p>

          <div className="mt-8 hidden rounded-2xl border border-white/10 bg-white/5 p-4 shadow-2xl shadow-black/40 backdrop-blur md:block">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                  Now in your queue
                </p>
                <p className="mt-1 text-sm font-bold text-white">
                  Late Night Drive
                </p>
              </div>
              <div className="rounded-full bg-orange-500/15 px-3 py-1 text-xs font-bold text-orange-300">
                Live
              </div>
            </div>
            <div className="flex h-20 items-end gap-1.5 overflow-hidden rounded-xl bg-black/30 px-3 py-3">
              {waveformBars.map((height, index) => (
                <span
                  aria-hidden="true"
                  className="flex-1 rounded-full bg-gradient-to-t from-orange-600 to-orange-300 opacity-90"
                  key={`${height}-${index}`}
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          </div>
        </section>

        <AuthForm
          mode="login"
          redirectTo={redirectTo}
          successMessage={
            registered ? "Register successful. Please login to continue." : undefined
          }
        />
      </div>
    </div>
  );
}
