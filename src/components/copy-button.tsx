"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

function copyTextWithTextArea(value: string) {
  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "");
  textArea.style.left = "-9999px";
  textArea.style.opacity = "0";
  textArea.style.position = "fixed";
  textArea.style.top = "0";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(textArea);
  }
}

async function copyText(value: string) {
  if (copyTextWithTextArea(value)) {
    return true;
  }

  if (!navigator.clipboard?.writeText || !window.isSecureContext) {
    return false;
  }

  try {
    await Promise.race([
      navigator.clipboard.writeText(value),
      new Promise((_, reject) => window.setTimeout(() => reject(new Error("clipboard-timeout")), 350)),
    ]);
    return true;
  } catch {
    return false;
  }
}

export function CopyButton({
  label = "复制",
  value,
}: {
  label?: string;
  value: string;
}) {
  const [status, setStatus] = useState<"copied" | "failed" | "idle">("idle");

  async function copy() {
    const copied = await copyText(value);
    setStatus(copied ? "copied" : "failed");
    window.setTimeout(() => setStatus("idle"), 1500);
  }

  return (
    <button className="copy-button" onClick={copy} type="button">
      {status === "copied" ? <Check size={15} /> : <Copy size={15} />}
      {status === "copied" ? "已复制" : status === "failed" ? "复制失败" : label}
    </button>
  );
}
