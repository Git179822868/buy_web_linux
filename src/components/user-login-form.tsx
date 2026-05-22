"use client";

import { LockKeyhole, Phone, RefreshCw, ShieldCheck, UserPlus } from "lucide-react";
import Image from "next/image";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type CaptchaState = {
  expiresAt: number;
  imageData: string;
  token: string;
};

export function UserLoginForm({
  initialCaptcha,
  nextPath = "/account",
}: {
  initialCaptcha: CaptchaState;
  nextPath?: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [captcha, setCaptcha] = useState<CaptchaState | null>(initialCaptcha);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  async function refreshCaptcha() {
    const response = await fetch("/api/captcha", { cache: "no-store" });
    const json = (await response.json()) as CaptchaState;
    setCaptcha(json);
    setCaptchaAnswer("");
  }

  function switchMode(nextMode: "login" | "register") {
    setMode(nextMode);
    setError("");
    void refreshCaptcha();
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const response = await fetch(mode === "login" ? "/api/auth/login" : "/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phone,
          password,
          confirmPassword,
          captchaAnswer,
          captchaToken: captcha?.token,
        }),
      });
      const json = await response.json();

      if (!response.ok) {
        setError(json.message || "操作失败");
        void refreshCaptcha();
        return;
      }

      router.push(nextPath);
      router.refresh();
    });
  }

  return (
    <form className="user-login-form" onSubmit={submit}>
      <div className="login-mode">
        <button className={mode === "login" ? "active" : ""} onClick={() => switchMode("login")} type="button">
          登录
        </button>
        <button className={mode === "register" ? "active" : ""} onClick={() => switchMode("register")} type="button">
          注册
        </button>
      </div>

      <label>
        <Phone size={20} />
        <input
          autoCapitalize="off"
          autoComplete="tel"
          autoCorrect="off"
          enterKeyHint="next"
          name="phone"
          inputMode="tel"
          onChange={(event) => setPhone(event.target.value)}
          placeholder="请输入手机号"
          spellCheck={false}
          type="tel"
          value={phone}
        />
      </label>
      <label>
        <LockKeyhole size={20} />
        <input
          autoCapitalize="off"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          autoCorrect="off"
          enterKeyHint={mode === "register" ? "next" : "done"}
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="请输入您的密码"
          spellCheck={false}
          type="password"
          value={password}
        />
      </label>
      {mode === "register" ? (
        <label>
          <LockKeyhole size={20} />
          <input
            autoCapitalize="off"
            autoComplete="new-password"
            autoCorrect="off"
            enterKeyHint="next"
            name="confirmPassword"
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="请再次输入密码"
            spellCheck={false}
            type="password"
            value={confirmPassword}
          />
        </label>
      ) : null}

      <div className="captcha-row">
        <label>
          <ShieldCheck size={20} />
          <input
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            enterKeyHint="go"
            inputMode="text"
            name="captcha"
            onChange={(event) => setCaptchaAnswer(event.target.value)}
            placeholder="请输入验证码"
            spellCheck={false}
            value={captchaAnswer}
          />
        </label>
        <button className="captcha-image" onClick={() => void refreshCaptcha()} title="刷新验证码" type="button">
          {captcha ? (
            <Image alt="验证码" height={48} src={captcha.imageData} unoptimized width={126} />
          ) : (
            <RefreshCw size={20} />
          )}
        </button>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      <button className="user-submit" disabled={isPending || !captcha} type="submit">
        {mode === "register" ? <UserPlus size={18} /> : <LockKeyhole size={18} />}
        {isPending ? "请稍候" : mode === "login" ? "登录" : "注册账号"}
      </button>
    </form>
  );
}
