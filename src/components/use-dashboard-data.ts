"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DashboardData } from "@/lib/dashboard-types";

export function useDashboardData(initial: DashboardData) {
  const [data, setData] = useState(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);
  const active = useRef(false);
  const pending = useRef<AbortController | null>(null);
  const lastAttempt = useRef(0);
  const refresh = useCallback(async () => {
    if (initial.mode === "demo" || pending.current || !active.current) return;
    const controller = new AbortController();
    pending.current = controller;
    lastAttempt.current = Date.now();
    setRefreshing(true);
    try {
      const response = await fetch("/api/portfolio", {
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(60000),
        ]),
      });
      const next: DashboardData = await response.json();
      if (
        !response.ok ||
        !["live", "local"].includes(next.mode) ||
        !Array.isArray(next.positions) ||
        !Array.isArray(next.research) ||
        !Array.isArray(next.activity) ||
        !Number.isSafeInteger(next.cashCents)
      )
        throw new Error("Portfolio unavailable");
      if (active.current && !controller.signal.aborted) {
        setData(next);
        setRefreshError(false);
        setRefreshedAt(new Date().toISOString());
      }
    } catch {
      if (active.current && !controller.signal.aborted) setRefreshError(true);
    } finally {
      if (pending.current === controller) pending.current = null;
      if (active.current) setRefreshing(false);
    }
  }, [initial.mode]);
  useEffect(() => {
    active.current = true;
    lastAttempt.current = Date.now();
    if (initial.mode === "demo")
      return () => {
        active.current = false;
      };
    const check = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastAttempt.current >= 60000
      )
        void refresh();
    };
    const interval = window.setInterval(check, 60000);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      active.current = false;
      pending.current?.abort();
      pending.current = null;
      window.clearInterval(interval);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [initial.mode, refresh]);
  return { data, refreshing, refreshError, refreshedAt, refresh };
}
