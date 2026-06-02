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
    <form
      className="mx-auto max-w-md space-y-4 rounded-lg border border-zinc-800 bg-zinc-950 p-6"
      onSubmit={handleSubmit}
      noValidate
    >
      {successMessage && (
        <div className="rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm text-green-300">
          {successMessage}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {isRegister && (
        <div>
          <label
            htmlFor="username"
            className="text-sm font-medium text-zinc-300"
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
            className="mt-2 w-full rounded-lg border border-zinc-800 bg-black px-3 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-green-500"
            placeholder="demo_user"
          />
          <p className="mt-1 text-xs text-zinc-500">
            3-30 characters, letters, numbers, or underscore.
          </p>
        </div>
      )}

      <div>
        <label htmlFor="email" className="text-sm font-medium text-zinc-300">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2 w-full rounded-lg border border-zinc-800 bg-black px-3 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-green-500"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label htmlFor="password" className="text-sm font-medium text-zinc-300">
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
          className="mt-2 w-full rounded-lg border border-zinc-800 bg-black px-3 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-green-500"
          placeholder="Minimum 6 characters"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-green-500 px-4 py-3 text-sm font-semibold text-green-950 transition hover:bg-green-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
      >
        {isSubmitting
          ? isRegister
            ? "Creating account..."
            : "Logging in..."
          : isRegister
            ? "Create account"
            : "Login"}
      </button>

      <p className="text-center text-sm text-zinc-500">
        {isRegister ? "Already have an account?" : "Need an account?"}{" "}
        <Link
          href={isRegister ? "/login" : "/register"}
          className="font-medium text-green-400 hover:text-green-300"
        >
          {isRegister ? "Login" : "Register"}
        </Link>
      </p>
    </form>
  );
}
