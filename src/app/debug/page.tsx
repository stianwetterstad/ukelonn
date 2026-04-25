"use client";

import { useEffect, useState } from "react";
import { APP_BASE_PATH } from "@/lib/appBasePath";

interface DebugInfo {
  https: boolean;
  protocol: string;
  hostname: string;
  swRegistrations: {
    scope: string;
    active: boolean;
    installing: boolean;
    waiting: boolean;
  }[];
  manifestUrl: string;
  manifestLoads: boolean;
  manifestStatus: number | null;
  iconsAccessible: Record<
    string,
    {
      ok: boolean;
      status: number | null;
      url: string;
    }
  >;
  notificationPermission: NotificationPermission;
  fcmToken: string | null;
  basePath: string;
}

function StatusIcon({ ok }: { ok: boolean }) {
  return ok ? <span className="text-green-600">✅</span> : <span className="text-red-600">❌</span>;
}

export default function DebugPage() {
  const [info, setInfo] = useState<DebugInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const isSecure =
        window.location.protocol === "https:" ||
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1";

      // Get service worker registrations
      const regs = await navigator.serviceWorker.getRegistrations();
      const swRegs = regs.map((reg) => ({
        scope: reg.scope,
        active: !!reg.active,
        installing: !!reg.installing,
        waiting: !!reg.waiting,
      }));

      // Check manifest
      const manifest = document.querySelector('link[rel="manifest"]');
      const manifestUrl = manifest?.getAttribute("href") || "";
      let manifestLoads = false;
      let manifestStatus: number | null = null;
      try {
        if (manifestUrl) {
          const absoluteManifestUrl = new URL(manifestUrl, window.location.href).href;
          const res = await fetch(absoluteManifestUrl, { cache: "no-store" });
          manifestStatus = res.status;
          manifestLoads = res.ok;
        }
      } catch {
        manifestLoads = false;
      }

      // Check icon URLs and confirm they return HTTP 200
      const iconsAccessible: Record<
        string,
        {
          ok: boolean;
          status: number | null;
          url: string;
        }
      > = {};
      const icons = [
        "icon-192.png",
        "icon-512.png",
        "apple-touch-icon.png",
      ];
      for (const icon of icons) {
        const url = `${window.location.origin}${APP_BASE_PATH}/${icon}`;
        try {
          const res = await fetch(url, { cache: "no-store" });
          iconsAccessible[icon] = {
            ok: res.status === 200,
            status: res.status,
            url,
          };
        } catch {
          iconsAccessible[icon] = {
            ok: false,
            status: null,
            url,
          };
        }
      }

      // Get FCM token from sessionStorage or localStorage
      let fcmToken = null;
      try {
        fcmToken =
          sessionStorage.getItem("fcm_token") ||
          localStorage.getItem("fcm_token");
      } catch {
        fcmToken = null;
      }

      setInfo({
        https: isSecure,
        protocol: window.location.protocol,
        hostname: window.location.hostname,
        swRegistrations: swRegs,
        manifestUrl,
        manifestLoads,
        manifestStatus,
        iconsAccessible,
        notificationPermission: Notification.permission,
        fcmToken,
        basePath: APP_BASE_PATH,
      });
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="text-gray-500">Loading debug info...</div>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="text-red-600">Failed to load debug info</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-6">🔍 PWA & FCM Debug Info</h1>

      {/* HTTPS Check */}
      <section className="mb-6 bg-white p-4 rounded border">
        <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
          <StatusIcon ok={info.https} />
          HTTPS & Security
        </h2>
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-mono bg-gray-100 px-2 py-1 rounded">protocol</span>:{" "}
            <span className="font-mono">{info.protocol}</span>
          </div>
          <div>
            <span className="font-mono bg-gray-100 px-2 py-1 rounded">hostname</span>:{" "}
            <span className="font-mono">{info.hostname}</span>
          </div>
          <div className="text-xs text-gray-600 mt-2">
            ℹ️ Service Workers require HTTPS (or localhost for dev)
          </div>
        </div>
      </section>

      {/* Service Worker */}
      <section className="mb-6 bg-white p-4 rounded border">
        <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
          <StatusIcon ok={info.swRegistrations.length > 0} />
          Service Workers
        </h2>
        {info.swRegistrations.length === 0 ? (
          <div className="text-red-600 text-sm">❌ No service workers registered</div>
        ) : (
          <div className="space-y-3">
            {info.swRegistrations.map((reg) => (
              <div key={reg.scope} className="bg-gray-50 p-3 rounded">
                <div className="font-mono text-xs break-all mb-2">{reg.scope}</div>
                <div className="text-xs space-y-1">
                  <div>Active: {reg.active ? "✅" : "❌"}</div>
                  <div>Installing: {reg.installing ? "🔄" : "-"}</div>
                  <div>Waiting: {reg.waiting ? "⏳" : "-"}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Manifest & Icons */}
      <section className="mb-6 bg-white p-4 rounded border">
        <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
          <StatusIcon ok={info.manifestLoads} />
          Manifest & Icons
        </h2>
        <div className="space-y-3 text-sm">
          <div>
            <div className="font-mono text-xs bg-gray-100 px-2 py-1 rounded mb-1">
              manifest URL
            </div>
            <div className="font-mono text-xs break-all">{info.manifestUrl}</div>
            <div className="text-xs text-gray-600 mt-1">
              Loads: {info.manifestLoads ? "✅" : "❌"}
              {" · HTTP status: "}
              <span className="font-mono">{info.manifestStatus ?? "n/a"}</span>
            </div>
          </div>

          <div className="border-t pt-3">
            <div className="font-mono text-xs bg-gray-100 px-2 py-1 rounded mb-2">
              icons
            </div>
            {Object.entries(info.iconsAccessible).map(([icon, details]) => (
              <div key={icon} className="flex items-center gap-2 py-1">
                <span className={details.ok ? "text-green-600" : "text-red-600"}>
                  {details.ok ? "✅" : "❌"}
                </span>
                <span className="font-mono text-xs">{icon}</span>
                <span className="text-xs text-gray-600">
                  (HTTP {details.status ?? "n/a"})
                </span>
                <span className="font-mono text-[10px] text-gray-500 break-all">
                  {details.url}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Notifications & FCM */}
      <section className="mb-6 bg-white p-4 rounded border">
        <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
          <StatusIcon ok={info.notificationPermission === "granted"} />
          Notifications & FCM
        </h2>
        <div className="space-y-3 text-sm">
          <div>
            <div className="font-mono text-xs bg-gray-100 px-2 py-1 rounded mb-1">
              Notification.permission
            </div>
            <div>
              {info.notificationPermission === "granted" ? (
                <span className="text-green-600">✅ {info.notificationPermission}</span>
              ) : (
                <span className="text-orange-600">⚠️ {info.notificationPermission}</span>
              )}
            </div>
            {info.notificationPermission === "default" && (
              <button
                onClick={() => Notification.requestPermission()}
                className="mt-2 px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
              >
                Request Permission
              </button>
            )}
          </div>

          <div className="border-t pt-3">
            <div className="font-mono text-xs bg-gray-100 px-2 py-1 rounded mb-1">
              FCM Token
            </div>
            {info.fcmToken ? (
              <div className="font-mono text-xs break-all bg-gray-50 p-2 rounded">
                {info.fcmToken}
              </div>
            ) : (
              <div className="text-gray-500 text-xs">
                Token will appear after FCM initializes (check console logs)
              </div>
            )}
            <div className="text-xs text-gray-600 mt-2">
              ℹ️ Token is stored after FCM initializes (production only)
            </div>
          </div>
        </div>
      </section>

      {/* Base Path */}
      <section className="mb-6 bg-white p-4 rounded border">
        <h2 className="text-lg font-semibold mb-2">Configuration</h2>
        <div className="text-sm space-y-1">
          <div>
            <span className="font-mono bg-gray-100 px-2 py-1 rounded">basePath</span>:{" "}
            <span className="font-mono">{info.basePath}</span>
          </div>
        </div>
      </section>

      {/* Documentation Links */}
      <section className="mb-6 bg-blue-50 p-4 rounded border border-blue-200">
        <h2 className="text-lg font-semibold mb-3">📚 Documentation</h2>
        <ul className="space-y-2 text-sm">
          <li>
            <a
              href="/ukelonn/#/push-notifications"
              className="text-blue-600 hover:underline"
            >
              Full Prod Test Steps
            </a>
            {" - See PUSH_NOTIFICATIONS.md"}
          </li>
          <li>
            <a href="/ukelonn/" className="text-blue-600 hover:underline">
              Back to App
            </a>
          </li>
        </ul>
      </section>

      {/* Console Helper */}
      <section className="mb-6 bg-yellow-50 p-4 rounded border border-yellow-200">
        <h2 className="text-lg font-semibold mb-3">💡 Console Helper</h2>
        <p className="text-sm mb-3">
          Run this in the browser console for a quick verification checklist:
        </p>
        <pre className="bg-gray-900 text-green-400 p-3 rounded text-xs overflow-x-auto">
{`(async () => {
  console.log("🔍 PWA & FCM Checklist\n");
  const isSecure = window.location.protocol === 'https:' || 
                   window.location.hostname === 'localhost';
  console.log(\`\${isSecure ? '✅' : '❌'} HTTPS\`);
  
  const regs = await navigator.serviceWorker.getRegistrations();
  const activeReg = regs.find(r => r.active);
  console.log(\`\${activeReg ? '✅' : '❌'} SW: \${activeReg?.scope}\`);
  
  const manifest = document.querySelector('link[rel="manifest"]');
  const manifestOk = await fetch(manifest?.href || '').then(r => r.ok);
  console.log(\`\${manifestOk ? '✅' : '❌'} Manifest loads\`);
  
  console.log("✨ All ✅ = Ready for prod");
})();`}
        </pre>
      </section>
    </div>
  );
}
