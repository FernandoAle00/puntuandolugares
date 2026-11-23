"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    // Service workers require a secure context (HTTPS or localhost)
    if (!window.isSecureContext) return;

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Non-fatal: standalone iOS Home Screen still works without SW
    });
  }, []);

  return null;
}
