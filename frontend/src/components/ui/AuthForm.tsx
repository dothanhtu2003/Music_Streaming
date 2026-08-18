"use client";

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

const waveformBars = [
  35, 65, 42, 88, 55, 75, 45, 92, 60, 48, 80, 52, 70, 40, 85, 58, 62, 38,
];

export function AuthForm({
  mode,
  redirectTo = "/home",
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
      return "Email không hợp lệ.";
    }

    if (isRegister && !usernameRegex.test(normalizedUsername)) {
      return "Tên người dùng phải từ 3-30 ký tự và chỉ dùng chữ, số hoặc dấu gạch dưới (_).";
    }

    if (isRegister) {
      if (password.length < 8 || password.length > 128) {
        return "Mật khẩu khi đăng ký phải từ 8 đến 128 ký tự.";
      }
    } else {
      if (!password || password.length > 128) {
        return "Vui lòng nhập mật khẩu.";
      }
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
        await login({
          email: normalizedEmail,
          password,
        });
        router.push(redirectTo);
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
          : "Đã có lỗi xảy ra. Vui lòng thử lại.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative w-full page-fade-in">
      {/* Neon Cyan Ambient Glow */}
      <div className="absolute inset-x-4 -top-12 -z-10 h-44 rounded-full bg-cyan-500/20 blur-3xl transition-all duration-500" />

      <div className="mx-auto w-full max-w-md rounded-3xl border border-cyan-500/20 bg-slate-950/80 p-5 shadow-2xl shadow-cyan-950/60 backdrop-blur-2xl sm:p-7">
        {/* Audio Waveform Equalizer Display */}
        <div className="mb-4 flex h-10 items-end justify-center gap-1.5 overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/60 px-4 py-2">
          {waveformBars.map((height, index) => (
            <span
              key={`${height}-${index}`}
              aria-hidden="true"
              className="flex-1 rounded-full bg-gradient-to-t from-cyan-500 to-blue-400 opacity-85 transition-all duration-300"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>

        {/* App Branding Header */}
        <div className="mb-5 text-center">
          <div className="mx-auto mb-2.5 flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-cyan-400 to-blue-600 text-slate-950 shadow-lg shadow-cyan-500/25">
            <span className="flex h-6 items-end gap-1" aria-hidden="true">
              <span className="h-2.5 w-1 rounded-full bg-slate-950" />
              <span className="h-5 w-1 rounded-full bg-slate-950" />
              <span className="h-3.5 w-1 rounded-full bg-slate-950" />
              <span className="h-6 w-1 rounded-full bg-slate-950" />
            </span>
          </div>
          <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">
            Music Streaming
          </h1>
          <p className="mt-1 text-xs text-cyan-200/70 sm:text-sm">
            {isRegister
              ? "Tạo tài khoản mới để hòa mình vào thế giới âm nhạc"
              : "Đăng nhập để khám phá kho nhạc của bạn"}
          </p>
        </div>

        {/* 2-Tab Segmented Control Bar */}
        <div className="mb-5 grid grid-cols-2 rounded-2xl border border-slate-800 bg-slate-900/90 p-1.5">
          <button
            type="button"
            onClick={() => router.push("/login")}
            className={`rounded-xl py-2.5 text-xs font-bold transition-all duration-200 sm:text-sm ${
              !isRegister
                ? "bg-gradient-to-r from-cyan-400 to-blue-500 font-black text-slate-950 shadow-md shadow-cyan-500/25"
                : "text-slate-400 hover:text-cyan-200"
            }`}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            onClick={() => router.push("/register")}
            className={`rounded-xl py-2.5 text-xs font-bold transition-all duration-200 sm:text-sm ${
              isRegister
                ? "bg-gradient-to-r from-cyan-400 to-blue-500 font-black text-slate-950 shadow-md shadow-cyan-500/25"
                : "text-slate-400 hover:text-cyan-200"
            }`}
          >
            Đăng ký
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-3.5 sm:space-y-4">
            {successMessage && (
              <div className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3.5 py-2.5 text-xs text-cyan-200 sm:text-sm">
                {successMessage}
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-200 sm:text-sm">
                {error}
              </div>
            )}

            {isRegister && (
              <div>
                <label
                  htmlFor="username"
                  className="text-[11px] font-bold uppercase tracking-wider text-slate-400 sm:text-xs"
                >
                  Tên người dùng (Username)
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
                  className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2.5 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-500/15 sm:py-3 sm:text-sm"
                  placeholder="demo_user"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  3-30 ký tự, gồm chữ cái, số hoặc dấu gạch dưới.
                </p>
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="text-[11px] font-bold uppercase tracking-wider text-slate-400 sm:text-xs"
              >
                Địa chỉ Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2.5 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-500/15 sm:py-3 sm:text-sm"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="text-[11px] font-bold uppercase tracking-wider text-slate-400 sm:text-xs"
              >
                Mật khẩu
              </label>
              <input
                id="password"
                name="password"
                type="password"
                minLength={isRegister ? 8 : 1}
                maxLength={128}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2.5 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-500/15 sm:py-3 sm:text-sm"
                placeholder={isRegister ? "Từ 8 - 128 ký tự" : "Nhập mật khẩu của bạn"}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-gradient-to-r from-cyan-400 via-teal-400 to-blue-500 px-4 py-3 text-sm font-black text-slate-950 shadow-lg shadow-cyan-500/25 transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
            >
              {isSubmitting
                ? isRegister
                  ? "Đang tạo tài khoản..."
                  : "Đang đăng nhập..."
                : isRegister
                  ? "Tạo tài khoản"
                  : "Đăng nhập"}
            </button>
          </div>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-800" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
              Sắp ra mắt
            </span>
            <div className="h-px flex-1 bg-slate-800" />
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
            <button
              type="button"
              disabled
              className="flex cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2.5 text-xs font-bold text-slate-500 transition"
              title="Google login is coming soon."
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12.24 10.285V13.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.578-7.859-8s3.53-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l2.427-2.334C18.155 2.1 15.44 1 12.24 1 7.165 1 3 5.03 3 10s4.165 9 9.24 9c5.3 0 8.825-3.696 8.825-8.914 0-.6-.064-1.06-.144-1.52H12.24z" />
              </svg>
              Google soon
            </button>
            <button
              type="button"
              disabled
              className="flex cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2.5 text-xs font-bold text-slate-500 transition"
              title="GitHub login is coming soon."
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
              </svg>
              GitHub soon
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
