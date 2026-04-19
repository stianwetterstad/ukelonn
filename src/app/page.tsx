import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <h1 className="text-3xl font-bold">Almas Ukelønn (Starter)</h1>
      <p className="text-sm text-gray-600">
        This starter includes placeholder pages for a parent dashboard and child checklist.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          className="rounded-md bg-black px-4 py-2 text-center text-white hover:bg-zinc-800"
          href="/parent"
        >
          Go to Parent Dashboard
        </Link>
        <Link
          className="rounded-md border border-gray-300 px-4 py-2 text-center hover:bg-gray-50"
          href="/child"
        >
          Go to Child Checklist
        </Link>
      </div>
    </main>
  );
}
