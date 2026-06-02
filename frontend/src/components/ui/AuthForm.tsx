"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/AuthProvider";

type AuthFormProps = {
  mode: "login" | "register";
  redirectTo?: string;
  successMessage?: string;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;

export function AuthForm({
  mode,
  redirectTo = "/",
  successMessage,
}: AuthFormProps) {
  const isRegister = mode === "register";
  const router = useRouter();
  const { login, register } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = () => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim();

    if (!emailRegex.test(normalizedEmail)) {
      return "Email is invalid.";
    }

    if (isRegister && !usernameRegex.test(normalizedUsername)) {
      return "Username must be 3-30 characters and only use letters, numbers, or underscore.";
    }

    if (password.length < 6) {
      return "Password must be at least 6 characters.";
    }

    return null;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      if (isRegister) {
        await register({
          email: normalizedEmail,
          username: username.trim(),
          password,
        });
        router.push("/login?registered=1");
        return;
      }

      await login({
        email: normalizedEmail,
        password,
      });
      router.push(redirectTo);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative py-4 md:py-8 page-fade-in">
      {/* Background glow effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 h-80 w-80 rounded-full bg-green-500/[0.08] blur-[100px]" />
      <div className="absolute top-1/3 left-1/4 -z-10 h-56 w-56 rounded-full bg-emerald-500/[0.04] blur-[80px]" />

      <form
        className="mx-auto max-w-md space-y-5 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 backdrop-blur-md p-6 sm:p-8 shadow-2xl relative"
        onSubmit={handleSubmit}
        noValidate
      >
        {successMessage && (
          <div className="rounded-xl border border-green-500/40 bg-green-500/10 px-3.5 py-2.5 text-sm text-green-300">
            {successMessage}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
            {error}
          </div>
        )}

        {isRegister && (
          <div>
            <label
              htmlFor="username"
              className="text-xs font-bold uppercase tracking-wider text-zinc-400"
            >
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              minLength={3}
              maxLength={30}
              pattern="[a-zA-Z0-9_]{3,30}"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="mt-2 w-full rounded-xl border border-zinc-800/80 bg-black/60 px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 hover:border-zinc-700 focus:border-green-500 focus:ring-2 focus:ring-green-500/10"
              placeholder="demo_user"
            />
            <p className="mt-1.5 text-[11px] text-zinc-500">
              3-30 characters, letters, numbers, or underscore.
            </p>
          </div>
        )}

        <div>
          <label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 w-full rounded-xl border border-zinc-800/80 bg-black/60 px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 hover:border-zinc-700 focus:border-green-500 focus:ring-2 focus:ring-green-500/10"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            minLength={6}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full rounded-xl border border-zinc-800/80 bg-black/60 px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 hover:border-zinc-700 focus:border-green-500 focus:ring-2 focus:ring-green-500/10"
            placeholder="Minimum 6 characters"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-green-500 px-4 py-3 text-sm font-bold text-green-950 transition hover:bg-green-400 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500 hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-green-500/10"
        >
          {isSubmitting
            ? isRegister
              ? "Creating account..."
              : "Logging in..."
            : isRegister
              ? "Create account"
              : "Login"}
        </button>

        {/* OR Spacer */}
        <div className="relative my-6 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-800/80"></div>
          </div>
          <span className="relative bg-[#09090b] px-3 text-[10px] text-zinc-500 uppercase tracking-wider">
            Or continue with
          </span>
        </div>

        {/* Social logins mock UI */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled
            className="flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/20 py-2.5 text-xs font-bold text-zinc-500 cursor-not-allowed hover:bg-zinc-900/40 hover:text-zinc-400 transition-colors"
            title="Google login is coming soon!"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12.24 10.285V13.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.578-7.859-8s3.53-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l2.427-2.334C18.155 2.1 15.44 1 12.24 1 7.165 1 3 5.03 3 10s4.165 9 9.24 9c5.3 0 8.825-3.696 8.825-8.914 0-.6-.064-1.06-.144-1.52H12.24z"/></svg>
            Google
          </button>
          <button
            type="button"
            disabled
            className="flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/20 py-2.5 text-xs font-bold text-zinc-500 cursor-not-allowed hover:bg-zinc-900/40 hover:text-zinc-400 transition-colors"
            title="GitHub login is coming soon!"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
            GitHub
          </button>
        </div>

        <p className="text-center text-xs text-zinc-500 pt-2">
          {isRegister ? "Already have an account?" : "Need an account?"}{" "}
          <Link
            href={isRegister ? "/login" : "/register"}
            className="font-bold text-green-400 hover:text-green-300 transition-colors"
          >
            {isRegister ? "Login" : "Register"}
          </Link>
        </p>
      </form>
    </div>
  );
}
