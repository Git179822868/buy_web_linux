"use client";

import Image from "next/image";
import { LockKeyhole, Save, UserRound } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type AccountSettingsUser = {
  avatarUrl: string | null;
  nickname: string | null;
  phone: string;
};

export function AccountProfileForm({ user }: { user: AccountSettingsUser }) {
  const router = useRouter();
  const [form, setForm] = useState({
    avatarUrl: user.avatarUrl || "",
    nickname: user.nickname || `用户${user.phone.slice(-4)}`,
  });
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const localPreviewUrl = form.avatarUrl.startsWith("/") ? form.avatarUrl : "";

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    startTransition(async () => {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await response.json();

      if (!response.ok) {
        setMessage(json.message || "保存失败");
        return;
      }

      setMessage("资料已保存");
      router.refresh();
    });
  }

  return (
    <form className="account-edit-form" onSubmit={submit}>
      <div className="account-avatar-editor">
        <div className="settings-avatar">
          {localPreviewUrl ? (
            <Image alt="用户头像" fill sizes="96px" src={localPreviewUrl} />
          ) : (
            <UserRound size={46} />
          )}
        </div>
        <span>头像预览</span>
      </div>
      <div className="field">
        <label htmlFor="nickname">用户昵称</label>
        <input
          id="nickname"
          onChange={(event) => setForm((current) => ({ ...current, nickname: event.target.value }))}
          value={form.nickname}
        />
      </div>
      <div className="field wide">
        <label htmlFor="avatarUrl">头像地址</label>
        <input
          id="avatarUrl"
          onChange={(event) => setForm((current) => ({ ...current, avatarUrl: event.target.value }))}
          placeholder="可粘贴图片 URL"
          value={form.avatarUrl}
        />
      </div>
      {message ? <p className={message.includes("失败") ? "error-text wide" : "success-text wide"}>{message}</p> : null}
      <button className="primary-button wide" disabled={isPending} type="submit">
        <Save size={17} />
        保存资料
      </button>
    </form>
  );
}

export function AccountPasswordForm() {
  const [form, setForm] = useState({
    confirmPassword: "",
    currentPassword: "",
    newPassword: "",
  });
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function patch(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    startTransition(async () => {
      const response = await fetch("/api/account/password", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await response.json();

      if (!response.ok) {
        setMessage(json.message || "修改失败");
        return;
      }

      setForm({ confirmPassword: "", currentPassword: "", newPassword: "" });
      setMessage("密码已更新");
    });
  }

  return (
    <form className="account-edit-form" onSubmit={submit}>
      <div className="field wide">
        <label htmlFor="currentPassword">当前密码</label>
        <input
          id="currentPassword"
          onChange={(event) => patch("currentPassword", event.target.value)}
          type="password"
          value={form.currentPassword}
        />
      </div>
      <div className="field">
        <label htmlFor="newPassword">新密码</label>
        <input
          id="newPassword"
          onChange={(event) => patch("newPassword", event.target.value)}
          type="password"
          value={form.newPassword}
        />
      </div>
      <div className="field">
        <label htmlFor="confirmPassword">确认新密码</label>
        <input
          id="confirmPassword"
          onChange={(event) => patch("confirmPassword", event.target.value)}
          type="password"
          value={form.confirmPassword}
        />
      </div>
      {message ? <p className={message.includes("失败") || message.includes("错误") ? "error-text wide" : "success-text wide"}>{message}</p> : null}
      <button className="primary-button wide" disabled={isPending} type="submit">
        <LockKeyhole size={17} />
        修改密码
      </button>
    </form>
  );
}
