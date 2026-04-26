import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 bg-gradient-to-b from-white to-pink-50 px-6 py-10">
      <div className="rounded-3xl border border-pink-100 bg-white/90 p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-pink-600">Almas ukelonn</p>
        <h1 className="mt-2 text-3xl font-black text-slate-900">Startside for app og varslingstest</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Herfra kan du ga rett til parent, child eller den dedikerte testsiden for produksjon og push-varsler.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link
          className="rounded-2xl bg-black px-4 py-3 text-center text-sm font-bold text-white hover:bg-zinc-800"
          href="/parent"
        >
          Gå til parent
        </Link>
        <Link
          className="rounded-2xl border border-gray-300 bg-white px-4 py-3 text-center text-sm font-bold hover:bg-gray-50"
          href="/child"
        >
          Gå til child
        </Link>
        <Link
          className="rounded-2xl bg-amber-500 px-4 py-3 text-center text-sm font-bold text-white hover:bg-amber-600"
          href="/prod-test"
        >
          Åpne prod-test
        </Link>
      </div>

      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950 shadow-sm">
        <p className="font-bold">For iPhone og iPad:</p>
        <p>
          Installer appen til Hjem-skjermen og apne den derfra nar du skal teste ekte push-varsler. Bruk prod-test
          for lokal varseltest og /debug for status.
        </p>
      </div>
    </main>
  );
}
