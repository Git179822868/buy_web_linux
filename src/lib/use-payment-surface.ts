"use client";

import { useSyncExternalStore } from "react";

const defaultSnapshot = {
  isMobileSurface: false,
  isWeChatBrowser: false,
};
let cachedSnapshot = defaultSnapshot;

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener("resize", onStoreChange);
  window.addEventListener("orientationchange", onStoreChange);

  return () => {
    window.removeEventListener("resize", onStoreChange);
    window.removeEventListener("orientationchange", onStoreChange);
  };
}

function getSnapshot() {
  if (typeof window === "undefined") {
    return defaultSnapshot;
  }

  const ua = window.navigator.userAgent.toLowerCase();
  const nextSnapshot = {
    isMobileSurface: /android|iphone|ipad|ipod|mobile/.test(ua),
    isWeChatBrowser: /micromessenger/.test(ua),
  };

  if (
    cachedSnapshot.isMobileSurface === nextSnapshot.isMobileSurface &&
    cachedSnapshot.isWeChatBrowser === nextSnapshot.isWeChatBrowser
  ) {
    return cachedSnapshot;
  }

  cachedSnapshot = nextSnapshot;
  return cachedSnapshot;
}

function getServerSnapshot() {
  return defaultSnapshot;
}

export function usePaymentSurface() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
