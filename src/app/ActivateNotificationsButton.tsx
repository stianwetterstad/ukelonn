"use client";

import { useEffect, useState } from "react";
import { initializeFCM } from "@/lib/fcm";

type Props = { role: "parent" | "child" };

export function ActivateNotificationsButton({ role }: Props) {
  const [status, setStatus] = useState<"checking" | "idle" | "busy" | "done" | "error">("checking");

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setStatus("idle");
      return;
    }
    setStatus(Notification.permission === "granted" ? "done" : "idle");
  }, []);

  async function handleClick() {
    setStatus("busy");
    try {
      const token = await initializeFCM(role);
      setStatus(token ? "done" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "checking" || status === "done") return null;

  return (
    <div className="flex justify-center py-4">
      <button
        onClick={() => void handleClick()}
        disabled={status === "busy"}
        className="rounded-full border border-gray-300 bg-white px-4 py-1.5 text-xs font-medium text-gray-500 shadow-sm active:bg-gray-50 disabled:opacity-50"
      >
        {status === "busy" ? "Aktiverer…" : status === "error" ? "Prøv igjen" : "Aktiver varsel"}
      </button>
    </div>
  );
}
