import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <h1 className="text-3xl font-bold">Almas Ukelønn</h1>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          className="rounded-md bg-black px-4 py-2 text-center text-white hover:bg-zinc-800"
          href="/parent"
        >
          Gå til parent
        </Link>
        <Link
          className="rounded-md border border-gray-300 px-4 py-2 text-center hover:bg-gray-50"
          href="/child"
        >
          Gå til child
        </Link>
      </div>
    </main>
  );
}
