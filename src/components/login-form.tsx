"use client";

import { LockKeyhole } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const json = await response.json();

      if (!response.ok) {
        setError(json.message || "登录失败");
        return;
      }

      router.push("/admin");
      router.refresh();
    });
  }

  return (
    <form className="form-stack" onSubmit={submit}>
      <div className="field">
        <label htmlFor="username">账号</label>
        <input id="username" onChange={(event) => setUsername(event.target.value)} value={username} />
      </div>
      <div className="field">
        <label htmlFor="password">密码</label>
        <input
          id="password"
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          value={password}
        />
      </div>
      {error ? <p className="error-text">{error}</p> : null}
      <button className="primary-button" disabled={isPending} type="submit">
        <LockKeyhole size={17} />
        {isPending ? "正在登录" : "登录后台"}
      </button>
    </form>
  );
}
