import { allowanceStore } from "@/lib/data";

export default function ChildPage() {
  const checklist = allowanceStore.getChildChecklist();

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-6 py-10">
      <h1 className="text-3xl font-bold">Child Checklist</h1>
      <p className="mt-2 text-sm text-gray-600">
        In-memory placeholder checklist. No real personal data is included.
      </p>
      <ul className="mt-6 space-y-2">
        {checklist.map((item) => {
          const checkboxId = `check-${item.id}`;
          const labelId = `check-label-${item.id}`;

          return (
            <li key={item.id} className="rounded-md border border-gray-200 p-3">
              <div className="flex items-center gap-3">
                <input
                  aria-labelledby={labelId}
                  checked={item.done}
                  id={checkboxId}
                  readOnly
                  type="checkbox"
                />
                <label htmlFor={checkboxId} id={labelId}>
                  {item.task}
                </label>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
