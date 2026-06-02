import { AuthForm } from "@/components/ui/AuthForm";
import { PageHeader } from "@/components/ui/PageHeader";

export default function RegisterPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Create account"
        title="Register"
        description="Create a user account with username, email, and password."
      />
      <AuthForm mode="register" />
    </div>
  );
}
