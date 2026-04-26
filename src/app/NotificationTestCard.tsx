"use client";

import { useEffect, useState } from "react";
import {
  emulateRoleNotification,
  getPushSupportStatus,
  type PushSupportStatus,
} from "@/lib/fcm";

type NotificationTestCardProps = {
  role: "parent" | "child";
};

const COPY = {
  parent: {
    title: "Test varsler pa denne enheten",
    body: "Bruk denne etter innlogging for a verifisere at forelder-varsler faktisk vises pa iPhone/iPad.",
    success: "Lokalt forelder-varsel sendt til denne enheten.",
  },
  child: {
    title: "Test varsler pa denne enheten",
    body: "Bruk denne etter opplasing for a verifisere at barn-varsler faktisk vises pa iPhone/iPad.",
    success: "Lokalt barn-varsel sendt til denne enheten.",
  },
} as const;

export function NotificationTestCard({ role }: NotificationTestCardProps) {
  const [pushStatus, setPushStatus] = useState<PushSupportStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPushStatus(getPushSupportStatus());
  }, []);

  async function handleSendTestNotification() {
    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      await emulateRoleNotification(role);
      setMessage(COPY[role].success);
      setPushStatus(getPushSupportStatus());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Klarte ikke a sende testvarsel.");
    } finally {
      setBusy(false);
    }
  }

  if (!pushStatus) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
      <h2 className="text-sm font-extrabold uppercase tracking-wider text-amber-900">
        {COPY[role].title}
      </h2>
      <p className="mt-1 text-sm text-amber-900/80">{COPY[role].body}</p>

      {pushStatus.isIOS && !pushStatus.isStandalone ? (
        <p className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-sm text-amber-950">
          Pa iPhone/iPad ma du installere appen til Hjem-skjermen og apne den derfra. Varsler virker ikke i vanlig Safari- eller Chrome-fane.
        </p>
      ) : null}

      {pushStatus.reason ? (
        <p className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-sm text-amber-950">
          Status: {pushStatus.reason}
        </p>
      ) : (
        <p className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-sm text-amber-950">
          Status: Enheten kan teste varsler direkte her.
        </p>
      )}

      <button
        type="button"
        onClick={() => void handleSendTestNotification()}
        disabled={busy || (pushStatus.isIOS && !pushStatus.isStandalone)}
        className="mt-3 rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Sender testvarsel..." : "Send testvarsel"}
      </button>

      {message ? <p className="mt-3 text-sm font-medium text-green-700">{message}</p> : null}
      {error ? <p className="mt-3 text-sm font-medium text-red-700">{error}</p> : null}
    </section>
  );
}
