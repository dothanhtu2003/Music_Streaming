import { AuthForm } from "@/components/ui/AuthForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { getSafeRedirectPath } from "@/lib/utils";

type LoginPageProps = {
  searchParams: Promise<{
    redirect?: string | string[];
    registered?: string | string[];
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const redirectTo = getSafeRedirectPath(params.redirect);
  const registered = Array.isArray(params.registered)
    ? params.registered[0] === "1"
    : params.registered === "1";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Welcome back"
        title="Login"
        description="Login with email and password to receive a JWT access token."
      />
      <AuthForm
        mode="login"
        redirectTo={redirectTo}
        successMessage={
          registered ? "Register successful. Please login to continue." : undefined
        }
      />
    </div>
  );
}
