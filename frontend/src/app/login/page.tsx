import { AuthForm } from "@/components/ui/AuthForm";
import { getSafeRedirectPath } from "@/lib/utils";

type LoginPageProps = {
  searchParams: Promise<{
    redirect?: string | string[];
    registered?: string | string[];
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const redirectTo = getSafeRedirectPath(params.redirect, "/home");
  const registered = Array.isArray(params.registered)
    ? params.registered[0] === "1"
    : params.registered === "1";

  return (
    <div className="relative isolate flex min-h-dvh w-full items-center justify-center overflow-hidden bg-slate-950 px-4 py-8 sm:px-6">
      <div
        className="absolute inset-0 -z-20"
        style={{
          background:
            "radial-gradient(circle at top, #0e1b38 0%, transparent 45%), linear-gradient(135deg, #020617 0%, #080e21 50%, #030712 100%)",
        }}
      />
      <div
        className="absolute inset-0 -z-10 opacity-25"
        style={{
          backgroundImage:
            "linear-gradient(rgba(6,182,212,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.05) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div className="absolute left-1/2 top-12 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-500/20 blur-3xl" />

      <div className="w-full max-w-md">
        <AuthForm
          mode="login"
          redirectTo={redirectTo}
          successMessage={
            registered ? "Đăng ký thành công! Vui lòng đăng nhập để tiếp tục." : undefined
          }
        />
      </div>
    </div>
  );
}
