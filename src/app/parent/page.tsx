import { allowanceStore } from "@/lib/data";

export default function ParentPage() {
  const tasks = allowanceStore.getParentDashboard();

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-6 py-10">
      <h1 className="text-3xl font-bold">Parent Dashboard</h1>
      <p className="mt-2 text-sm text-gray-600">
        In-memory placeholder data for assigned and completed tasks.
      </p>
      <ul className="mt-6 space-y-3">
        {tasks.map((task) => (
          <li key={task.id} className="rounded-md border border-gray-200 p-4">
            <h2 className="font-semibold">{task.task}</h2>
            <p className="text-sm text-gray-600">
              Completed {task.completed} of {task.assigned}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
