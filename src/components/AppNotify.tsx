"use client";

import { useEffect } from "react";

const SEEN_KEY = "ftc_push_seen_id";
const SEEN_MANAGE = "ftc_push_seen_manage";
const NOTIFY_ID = 41001;
const MANAGE_ID = 41003;

type Head = {
  id?: string | null;
  label?: string | null;
  kind?: string | null;
  title?: string | null;
  body?: string | null;
};

function nativePlugins() {
  const cap = (window as unknown as { Capacitor?: { Plugins?: Record<string, unknown>; isNativePlatform?: () => boolean } })
    .Capacitor;
  if (!cap?.isNativePlatform?.() || !cap.Plugins?.LocalNotifications) return null;
  return cap.Plugins.LocalNotifications as {
    requestPermissions: () => Promise<{ display?: string }>;
    schedule: (opts: {
      notifications: Array<{ id: number; title: string; body: string; extra?: Record<string, string> }>;
    }) => Promise<void>;
  };
}

async function readHead(): Promise<Head | null> {
  try {
    const res = await fetch("/api/push/head", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as Head;
  } catch {
    return null;
  }
}

async function alertNew(head: Head, manage: boolean) {
  if (!head.id) return;
  const plugins = nativePlugins();
  if (!plugins) return;
  const pair = head.label || "the desk";
  try {
    await plugins.schedule({
      notifications: [
        {
          id: manage ? MANAGE_ID : NOTIFY_ID,
          title: head.title || (manage ? "Trade update" : "New signal"),
          body:
            head.body ||
            (manage
              ? `${pair} stop was updated. Open the app for details.`
              : `${pair} is on the desk. Open the app to view the card.`),
          extra: { id: head.id },
        },
      ],
    });
  } catch {
    /* permission denied or plugin missing */
  }
}

export function AppNotify() {
  useEffect(() => {
    const plugins = nativePlugins();
    if (!plugins) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    let stopped = false;

    (async () => {
      try {
        await plugins.requestPermissions();
      } catch {
        /* user declined */
      }
      const first = await readHead();
      if (stopped) return;
      if (first?.id && !localStorage.getItem(SEEN_KEY)) {
        localStorage.setItem(SEEN_KEY, first.id);
      }
      timer = setInterval(async () => {
        const head = await readHead();
        if (head?.id) {
          const seen = localStorage.getItem(SEEN_KEY);
          if (head.id !== seen) {
            localStorage.setItem(SEEN_KEY, head.id);
            await alertNew(head, false);
          }
        }
        try {
          const me = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
          const mine = await me.json();
          if (mine?.user?.plan !== "premium") return;
          const res = await fetch("/api/push/manage", { credentials: "include", cache: "no-store" });
          const manage = (await res.json()) as Head;
          if (!manage?.id) return;
          const seenM = localStorage.getItem(SEEN_MANAGE);
          if (manage.id === seenM) return;
          localStorage.setItem(SEEN_MANAGE, manage.id);
          await alertNew(manage, true);
        } catch {
          /* not signed in */
        }
      }, 12_000);
    })();

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
    };
  }, []);

  return null;
}
