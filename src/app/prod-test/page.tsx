import Link from "next/link";
import { NotificationTestCard } from "@/app/NotificationTestCard";

const STEPS = [
  "Installer appen til Hjem-skjermen pa iPhone/iPad for a teste ekte web-push.",
  "Apne debug-siden for a kontrollere at standalone er yes og at service worker er aktiv.",
  "Bruk testknappene under for lokal varsling pa denne enheten.",
  "Apne parent for innlogging og child for daglig flyt nar du vil teste ekte rolle-flyt.",
  "Bruk Firebase Console eller Cloud Functions nar du vil sende ekte FCM-meldinger.",
] as const;

const LINKS = [
  { href: "/debug", label: "Apne debug", style: "bg-slate-900 text-white hover:bg-slate-800" },
  { href: "/parent", label: "Apne parent", style: "bg-pink-500 text-white hover:bg-pink-600" },
  { href: "/child", label: "Apne child", style: "border border-pink-200 bg-white text-pink-700 hover:bg-pink-50" },
] as const;

export default function ProdTestPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 bg-gradient-to-b from-amber-50 via-white to-pink-50 px-6 py-8 md:px-8 md:py-10">
      <section className="rounded-3xl border border-amber-200 bg-white/90 p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-700">Produksjonstest</p>
        <h1 className="mt-2 text-3xl font-black text-slate-900 md:text-4xl">Testmiljo for varsler i prod</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-700 md:text-base">
          Denne siden er laget for testing pa ekte enheter i produksjon. Her far du rask tilgang til lokal varsling,
          debugstatus og rolle-sidene uten a lete rundt i appen.
        </p>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-2xl px-4 py-3 text-center text-sm font-bold transition ${link.style}`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 rounded-3xl border border-pink-100 bg-white/80 p-6 shadow-sm md:grid-cols-[1.2fr_0.8fr]">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Anbefalt testflyt</h2>
          <ol className="mt-3 space-y-3 text-sm text-slate-700">
            {STEPS.map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-200 text-xs font-bold text-amber-900">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <h3 className="font-extrabold uppercase tracking-wide">iPhone og iPad</h3>
          <p className="mt-2 leading-6">
            Web-push virker bare nar appen er installert til Hjem-skjermen pa iOS/iPadOS 16.4+. Testing i vanlig
            Safari- eller Chrome-fane er ikke representativt.
          </p>
          <p className="mt-3 leading-6">
            Hvis debug-siden viser standalone: no, er du ikke i riktig kontekst for ekte push og tokenregistrering.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <NotificationTestCard role="parent" />
        <NotificationTestCard role="child" />
      </section>
    </main>
  );
}