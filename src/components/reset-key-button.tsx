"use client";

import { RotateCcw } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function ResetKeyButton() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function resetKey() {
    const confirmed = window.confirm("确定要重置 AppSecret 吗？旧密钥会立即失效。");

    if (!confirmed) {
      return;
    }

    setMessage("");
    startTransition(async () => {
      const response = await fetch("/api/account/keys/reset", { method: "POST" });
      const json = await response.json();

      if (!response.ok) {
        setMessage(json.message || "重置失败");
        return;
      }

      setMessage("密钥已重置");
      router.refresh();
    });
  }

  return (
    <div className="key-actions">
      <button className="secondary-button" disabled={isPending} onClick={resetKey} type="button">
        <RotateCcw size={17} />
        {isPending ? "处理中" : "重置密钥"}
      </button>
      {message ? <span>{message}</span> : null}
    </div>
  );
}
