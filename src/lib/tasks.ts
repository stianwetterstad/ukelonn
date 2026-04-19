// ─── Shared task data model ─────────────────────────────────────────────────
// In-memory store used by both /child and /parent.
// No database — state lives as a module-level singleton so both pages
// share the same objects during the same browser session when imported
// through a React context / hook.

export type ApprovalStatus = "none" | "pending" | "approved" | "rejected";

export type Task = {
  id: string;
  title: string;
  type: "weekly" | "bonus";
  /** Which weekday this task belongs to (only for type=weekly) */
  day?: string;
  /** Subtitle hint shown on child page (optional) */
  subtitle?: string;
  /** Bonus value in NOK (only for type=bonus) */
  valueNok?: number;
  /** true when the child has toggled the task as done */
  checkedByChild: boolean;
  /** Parent approval status */
  approvalStatus: ApprovalStatus;
};

// ─── Initial seed data ──────────────────────────────────────────────────────

const DAYS = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag"] as const;

export type TaskSeedData = Omit<Task, "id">;

export const INITIAL_TASKS: TaskSeedData[] = [
  // ── Mandag ──
  { title: "Rydde rommet (5 min)", type: "weekly", day: "Mandag", checkedByChild: false, approvalStatus: "none" },
  { title: "Tømme oppvaskmaskinen", type: "weekly", day: "Mandag", checkedByChild: false, approvalStatus: "none" },
  { title: "Legge skolesekk og klær på plass", type: "weekly", day: "Mandag", checkedByChild: false, approvalStatus: "none" },
  // ── Tirsdag ──
  { title: "Dekke bordet", type: "weekly", day: "Tirsdag", checkedByChild: false, approvalStatus: "none" },
  { title: "Rydde av bordet + sette i oppvaskmaskinen", type: "weekly", day: "Tirsdag", checkedByChild: false, approvalStatus: "none" },
  { title: "Sortere skittentøy i kurv", type: "weekly", day: "Tirsdag", checkedByChild: false, approvalStatus: "none" },
  // ── Onsdag ──
  { title: "Gå ut med søppel/kildesortering", type: "weekly", day: "Onsdag", checkedByChild: false, approvalStatus: "none" },
  { title: "Tørke kjøkkenbenk med klut (vann)", type: "weekly", day: "Onsdag", checkedByChild: false, approvalStatus: "none" },
  { title: "Rydde leker/fellesområde (5 min)", type: "weekly", day: "Onsdag", checkedByChild: false, approvalStatus: "none" },
  // ── Torsdag ──
  { title: "Smøre egen matpakke (med sjekk)", type: "weekly", day: "Torsdag", checkedByChild: false, approvalStatus: "none" },
  { title: "Legge bort rent tøy (enkelt)", type: "weekly", day: "Torsdag", checkedByChild: false, approvalStatus: "none" },
  { title: "Rydde rommet (3 min)", type: "weekly", day: "Torsdag", checkedByChild: false, approvalStatus: "none" },
  // ── Fredag ──
  { title: "Sette sko/jakke pent i gangen", type: "weekly", day: "Fredag", checkedByChild: false, approvalStatus: "none" },
  { title: "Legge inn i oppvaskmaskinen etter middag", type: "weekly", day: "Fredag", checkedByChild: false, approvalStatus: "none" },
  { title: "Velge én hjelpe-oppgave", type: "weekly", day: "Fredag", subtitle: "(vanne plante / tørke støv / rydde bordplass)", checkedByChild: false, approvalStatus: "none" },
  // ── Bonus ──
  { title: "Pante flasker", type: "bonus", valueNok: 10, checkedByChild: false, approvalStatus: "none" },
  { title: "Støvsuge gangen", type: "bonus", valueNok: 10, checkedByChild: false, approvalStatus: "none" },
  { title: "Rydde leker i stua", type: "bonus", valueNok: 5, checkedByChild: false, approvalStatus: "none" },
  { title: "Hjelpe til å lage middag", type: "bonus", valueNok: 10, checkedByChild: false, approvalStatus: "none" },
  { title: "Vaske badet (sammen med voksen)", type: "bonus", valueNok: 15, checkedByChild: false, approvalStatus: "none" },
  { title: "Brette klær", type: "bonus", valueNok: 10, checkedByChild: false, approvalStatus: "none" },
];

export const INITIAL_BASE_ALLOWANCE = 50;

export const WEEKDAYS = DAYS;

// ─── Helper: group weekly tasks by day ──────────────────────────────────────
export function groupByDay(tasks: Task[]): { day: string; tasks: Task[] }[] {
  return DAYS.map((day) => ({
    day,
    tasks: tasks.filter((t) => t.type === "weekly" && t.day === day),
  }));
}
