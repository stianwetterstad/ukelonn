"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useTaskStore } from "@/lib/TaskContext";
import type { ApprovalStatus } from "@/lib/tasks";
import { ActivateNotificationsButton } from "@/app/ActivateNotificationsButton";

// ─── Modal type ─────────────────────────────────────────────────────────────
type ModalState =
  | null
  | { mode: "add-weekday"; day: string }
  | { mode: "edit-weekday"; taskId: string; text: string; standardTaskId?: string }
  | { mode: "add-bonus" }
  | { mode: "edit-bonus"; taskId: string; text: string; value: number; standardTaskId?: string };

// ─── Savings goal helpers ─────────────────────────────────────────────────────
type SavingsGoalItem = { name: string; price: number };

const DEFAULT_GOALS: SavingsGoalItem[] = [
  { name: "", price: 0 },
  { name: "", price: 0 },
  { name: "", price: 0 },
];

function parseSavingsGoal(value: string): SavingsGoalItem[] {
  if (!value) return DEFAULT_GOALS;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return DEFAULT_GOALS;
    return DEFAULT_GOALS.map((_, i) => {
      const item = parsed[i] as Partial<SavingsGoalItem> | undefined;
      return {
        name: typeof item?.name === "string" ? item.name : "",
        price: Math.max(0, Number(item?.price) || 0),
      };
    });
  } catch {
    return DEFAULT_GOALS;
  }
}

// ─── Component ──────────────────────────────────────────────────────────────
export default function ParentPage() {
  // ── Auth state ──
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const store = useTaskStore();
  const {
    tasks,
    dayGroups,
    bonusTasks,
    baseAllowance,
    totalWeekly,
    approvedWeeklyCount,
    maxBonus,
    approvedBonusSum,
    totalEarned,
    balance,
    savingsGoal,
    childPinConfigured,
    setApproval,
    approveAllPending,
    setBaseAllowance,
    setBalance,
    setSavingsGoal,
    setChildPin,
    clearChildPin,
    addTask,
    editTask,
    deleteTask,
    upsertStandardTask,
    removeStandardTask,
    childToggle,
    seedInitialTasks,
    resetAllData,
  } = store;

  // ── Admin loading state ──
  const [adminLoading, setAdminLoading] = useState(false);

  // ── Balance / savings state ──
  const [balanceInput, setBalanceInput] = useState("");
  const goals = useMemo(() => parseSavingsGoal(savingsGoal), [savingsGoal]);

  function updateGoal(index: number, field: "name" | "price", value: string) {
    const nextGoals = goals.map((g, i) =>
      i === index
        ? { ...g, [field]: field === "price" ? Math.max(0, Number(value) || 0) : value }
        : g
    );
    void setSavingsGoal(JSON.stringify(nextGoals));
  }

  function weeksNeeded(price: number) {
    const remaining = Math.max(0, price - balance);
    return Math.ceil(remaining / baseAllowance);
  }

  // ── UI state ──
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    weekday: false, bonus: false, settings: false,
  });
  const [modal, setModal] = useState<ModalState>(null);
  const [modalText, setModalText] = useState("");
  const [modalValue, setModalValue] = useState("");
  const [modalIsStandard, setModalIsStandard] = useState(false);
  const [childPinInput, setChildPinInput] = useState("");
  const [childPinConfirm, setChildPinConfirm] = useState("");
  const [childPinBusy, setChildPinBusy] = useState(false);
  const [childPinMessage, setChildPinMessage] = useState("");
  const [childPinError, setChildPinError] = useState("");

  // ── Auth listener (onAuthStateChanged holder auth-state synkronisert) ──
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    // Fallback: if auth never resolves (e.g. network issues), stop loading after 5s
    const timeout = setTimeout(() => setAuthLoading(false), 5000);
    return () => {
      unsub();
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    const source = new URLSearchParams(window.location.search).get("src");
    if (!source) {
      return;
    }

    console.log("[Notify] Opened parent page from push source:", source);
  }, []);

  // ── Pending queue ──
  const pendingItems = tasks.filter((t) => t.approvalStatus === "pending");

  // ── UI helpers ──
  function toggleSection(key: string) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function openModal(m: ModalState) {
    if (!m) return;
    setModal(m);
    if (m.mode === "edit-weekday") {
      setModalText(m.text);
      setModalValue("");
      setModalIsStandard(Boolean(m.standardTaskId));
    } else if (m.mode === "edit-bonus") {
      setModalText(m.text);
      setModalValue(String(m.value));
      setModalIsStandard(Boolean(m.standardTaskId));
    } else {
      setModalText("");
      setModalValue("");
      setModalIsStandard(false);
    }
  }

  async function saveModal() {
    if (!modal) return;
    const text = modalText.trim();
    if (!text) return;

    if (modal.mode === "add-weekday") {
      const newId = await addTask({ title: text, type: "weekly", day: modal.day });
      if (modalIsStandard) {
        await upsertStandardTask({
          id: newId, title: text, type: "weekly", day: modal.day,
          checkedByChild: false, approvalStatus: "none",
        });
      }
    } else if (modal.mode === "edit-weekday") {
      await editTask(modal.taskId, { title: text });
      const wasStandard = Boolean(modal.standardTaskId);
      if (modalIsStandard && !wasStandard) {
        const task = tasks.find((t) => t.id === modal.taskId);
        if (task) await upsertStandardTask({ ...task, title: text });
      } else if (!modalIsStandard && wasStandard) {
        await removeStandardTask(modal.standardTaskId!, modal.taskId);
      }
    } else if (modal.mode === "add-bonus") {
      const val = Math.max(1, Number(modalValue) || 5);
      const newId = await addTask({ title: text, type: "bonus", valueNok: val });
      if (modalIsStandard) {
        await upsertStandardTask({
          id: newId, title: text, type: "bonus", valueNok: val,
          checkedByChild: false, approvalStatus: "none",
        });
      }
    } else if (modal.mode === "edit-bonus") {
      const val = Math.max(1, Number(modalValue) || 5);
      await editTask(modal.taskId, { title: text, valueNok: val });
      const wasStandard = Boolean(modal.standardTaskId);
      if (modalIsStandard && !wasStandard) {
        const task = tasks.find((t) => t.id === modal.taskId);
        if (task) await upsertStandardTask({ ...task, title: text, valueNok: val });
      } else if (!modalIsStandard && wasStandard) {
        await removeStandardTask(modal.standardTaskId!, modal.taskId);
      }
    }
    setModal(null);
  }

  // ── Status badge ──
  function badge(status: ApprovalStatus) {
    if (status === "none") return <span className="shrink-0 text-xs text-gray-400">—</span>;
    if (status === "pending") return <span className="shrink-0 text-xs font-bold text-amber-600">⏳</span>;
    if (status === "approved") return <span className="shrink-0 text-xs font-bold text-green-600">✅</span>;
    return <span className="shrink-0 text-xs font-bold text-red-500">❌</span>;
  }
  // ── Auth helpers ──
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
        setAuthError("Feil e-post eller passord. Prøv igjen.");
      } else if (code === "auth/network-request-failed") {
        setAuthError("Ingen nettverkstilkobling. Sjekk internett og prøv igjen.");
      } else if (code === "auth/too-many-requests") {
        setAuthError("For mange forsøk. Vent litt og prøv igjen.");
      } else {
        setAuthError("Innlogging feilet. Prøv igjen.");
      }
    }
  }

  async function handleSaveChildPin() {
    setChildPinError("");
    setChildPinMessage("");

    if (!/^\d{4}$/.test(childPinInput)) {
      setChildPinError("PIN må være nøyaktig 4 siffer.");
      return;
    }

    if (childPinInput !== childPinConfirm) {
      setChildPinError("PIN-feltene må være like.");
      return;
    }

    setChildPinBusy(true);
    try {
      await setChildPin(childPinInput);
      setChildPinInput("");
      setChildPinConfirm("");
      setChildPinMessage("PIN lagret og synkronisert.");
    } catch (err: unknown) {
      setChildPinError(err instanceof Error ? err.message : "Klarte ikke å lagre PIN.");
    } finally {
      setChildPinBusy(false);
    }
  }

  async function handleResetChildPin() {
    if (!confirm("Fjerne PIN for barnesiden?")) {
      return;
    }

    setChildPinBusy(true);
    setChildPinError("");
    setChildPinMessage("");

    try {
      await clearChildPin();
      setChildPinInput("");
      setChildPinConfirm("");
      setChildPinMessage("PIN er fjernet.");
    } catch (err: unknown) {
      setChildPinError(err instanceof Error ? err.message : "Klarte ikke å fjerne PIN.");
    } finally {
      setChildPinBusy(false);
    }
  }

  // ── Auth guards ──
  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Laster…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-pink-50 px-4">
        <form onSubmit={handleLogin} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg">
          <h1 className="mb-4 text-center text-xl font-bold text-pink-700">Forelder-innlogging 🔐</h1>
          {authError && (
            <p role="alert" className="mb-3 rounded-lg bg-red-100 px-3 py-2 text-sm text-red-700">{authError}</p>
          )}
          <label htmlFor="login-email" className="block text-xs font-semibold text-gray-600">E-post</label>
          <input
            id="login-email"
            type="email"
            placeholder="forelder@example.com"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            className="mb-4 mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
            required
            autoComplete="email"
          />
          <label htmlFor="login-password" className="block text-xs font-semibold text-gray-600">Passord</label>
          <input
            id="login-password"
            type="password"
            placeholder="••••••••"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            className="mb-5 mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
            required
            autoComplete="current-password"
          />
          <button
            type="submit"
            className="w-full rounded-lg bg-pink-500 py-2.5 text-sm font-bold text-white active:bg-pink-600"
          >
            Logg inn
          </button>
          <a
            href="https://alma.rocks"
            className="mt-4 block text-center text-xs text-gray-400 hover:text-gray-600"
          >
            ← Tilbake til Alma
          </a>
        </form>
      </main>
    );
  }
  const isBonus = modal?.mode === "add-bonus" || modal?.mode === "edit-bonus";

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col pb-10">
      {/* ── Header ── */}
      <header className="relative bg-pink-400 px-4 py-3 text-center">
        <a
          href="https://alma.rocks"
          className="absolute left-3 top-3 flex items-center gap-0.5 rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold text-white hover:bg-white/30"
        >
          ← Alma
        </a>
        <h1 className="text-xl font-extrabold uppercase tracking-wide text-white md:text-2xl">
          Forelder‑dashboard 👩‍👧
        </h1>
        <p className="mt-0.5 text-sm text-pink-100">Godkjenn oppgaver og se progresjon</p>
        <button
          onClick={() => signOut(auth)}
          className="mt-1 rounded-lg bg-pink-500/70 px-3 py-1 text-xs font-bold text-white active:bg-pink-600"
        >
          Logg ut
        </button>
      </header>

      {/* ── Admin panel ── */}
      <div className="px-4 py-3">
        <div className="rounded-xl border border-gray-300 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-black">
            Admin
          </h2>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              disabled={adminLoading || tasks.length > 0}
              onClick={async () => {
                setAdminLoading(true);
                try { await seedInitialTasks(); } finally { setAdminLoading(false); }
              }}
              className="flex-1 rounded-lg bg-pink-600 py-2.5 text-sm font-bold text-white hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {adminLoading ? "Oppretter…" : "Opprett standardoppgaver"}
            </button>
            <button
              disabled={adminLoading || tasks.length === 0}
              onClick={async () => {
                if (!confirm("Er du sikker på at du vil nullstille alle data? Dette kan ikke angres.")) return;
                setAdminLoading(true);
                try { await resetAllData(); } finally { setAdminLoading(false); }
              }}
              className="flex-1 rounded-lg bg-pink-600 py-2.5 text-sm font-bold text-white hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {adminLoading ? "Nullstiller…" : "Nullstill alle data"}
            </button>
          </div>
          <p className="mt-2 text-xs text-black">
            {tasks.length === 0
              ? "Ingen oppgaver finnes – klikk «Opprett standardoppgaver» for å fylle inn standarddata."
              : "Oppgaver finnes allerede – nullstill alle data før du kan opprette standardoppgaver på nytt."}
          </p>
        </div>
      </div>

      {/* ── Sticky summary bar ── */}
      <div className="sticky top-0 z-30 border-b border-pink-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
          <span className="font-bold text-pink-800">{approvedWeeklyCount}/{totalWeekly} godkjent</span>
          <span className="text-amber-700">
            Bonus: <strong className="text-amber-800">+kr {approvedBonusSum}</strong>
            <span className="text-amber-500">/{maxBonus}</span>
          </span>
          <span>
            <span className="text-lg font-extrabold text-green-700">kr {totalEarned},–</span>
            <span className="ml-1 text-xs text-gray-500">total</span>
          </span>
        </div>
        {pendingItems.length === 0 ? (
          <p className="mt-1 text-center text-xs font-bold text-green-600">Alt godkjent ✅</p>
        ) : (
          <p className="mt-1 text-center text-xs text-amber-600">
            {pendingItems.length} oppgave{pendingItems.length !== 1 && "r"} venter på godkjenning ⏳
          </p>
        )}
      </div>

      {/* ── Til godkjenning ── */}
      <section id="pending-approval" className="px-4 pt-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-pink-600">
            Til godkjenning ({pendingItems.length})
          </h2>
          {pendingItems.length > 1 && (
            <button onClick={approveAllPending} className="rounded-lg bg-green-500 px-3 py-1.5 text-xs font-bold text-white active:bg-green-600">
              Godkjenn alle ✅
            </button>
          )}
        </div>
        {pendingItems.length === 0 ? (
          <div className="rounded-xl bg-green-50 px-4 py-6 text-center text-sm text-green-700">
            Ingen oppgaver venter – alt er oppdatert 🎉
          </div>
        ) : (
          <ul className="space-y-2">
            {pendingItems.map((item) => (
              <li key={item.id} className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium text-gray-900">{item.title}</p>
                  <p className="text-xs text-gray-500">
                    {item.type === "weekly" ? item.day : `Bonus +kr ${item.valueNok ?? 0}`}
                  </p>
                </div>
                <button onClick={() => setApproval(item.id, "approved")} className="shrink-0 rounded-lg bg-green-500 px-3 py-2 text-sm font-bold text-white active:bg-green-600">
                  ✅ Godkjenn
                </button>
                <button onClick={() => setApproval(item.id, "rejected")} className="shrink-0 rounded-lg bg-red-400 px-3 py-2 text-sm font-bold text-white active:bg-red-500">
                  ❌ Avslå
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Accordion: Ukelønn-oppgaver ── */}
      <section className="mt-4 px-4">
        <button onClick={() => toggleSection("weekday")} className="flex w-full items-center justify-between rounded-xl bg-pink-100 px-4 py-3 text-left active:bg-pink-200">
          <span className="text-sm font-bold uppercase tracking-wider text-pink-700">Ukelønn‑oppgaver (mandag–fredag)</span>
          <span className="text-lg text-pink-400">{openSections.weekday ? "▲" : "▼"}</span>
        </button>

        {openSections.weekday && (
          <div className="mt-2 space-y-3">
            {dayGroups.map((day) => {
              const dayApproved = day.tasks.length > 0 && day.tasks.every((t) => t.approvalStatus === "approved");
              return (
                <div key={day.day} className={`overflow-hidden rounded-xl border ${dayApproved ? "border-green-300 bg-green-50" : "border-pink-200 bg-pink-50"}`}>
                  <div className={`flex items-center justify-between px-3 py-2 ${dayApproved ? "bg-green-100" : "bg-pink-100"}`}>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-pink-700">{day.day}</h3>
                    {dayApproved && <span className="text-sm text-green-500">✓</span>}
                  </div>

                  <ul className="divide-y divide-pink-100">
                    {day.tasks.map((task) => (
                      <li key={task.id} className="flex items-center gap-1.5 px-3 py-2">
                        <p className="min-w-0 flex-1 break-words text-sm text-gray-800">{task.title}</p>
                        {badge(task.approvalStatus)}

                        {task.approvalStatus === "pending" && (
                          <>
                            <button onClick={() => setApproval(task.id, "approved")} className="shrink-0 rounded bg-green-500 px-2 py-1 text-xs font-bold text-white">✅</button>
                            <button onClick={() => setApproval(task.id, "rejected")} className="shrink-0 rounded bg-red-400 px-2 py-1 text-xs font-bold text-white">❌</button>
                          </>
                        )}
                        {task.approvalStatus === "none" && !task.checkedByChild && (
                          <button onClick={() => childToggle(task.id)} className="shrink-0 rounded bg-pink-200 px-2 py-1 text-xs text-pink-700 active:bg-pink-300">Simuler</button>
                        )}
                        {task.approvalStatus === "rejected" && (
                          <button onClick={() => setApproval(task.id, "none")} className="shrink-0 rounded bg-gray-200 px-2 py-1 text-xs text-gray-600">Tilbakestill</button>
                        )}

                        <button
                          onClick={() => openModal({ mode: "edit-weekday", taskId: task.id, text: task.title, standardTaskId: task.standardTaskId })}
                          className="shrink-0 rounded bg-blue-100 px-2 py-1 text-xs text-blue-700 active:bg-blue-200"
                        >✏️</button>
                        <button
                          onClick={() => deleteTask(task.id)}
                          className="shrink-0 rounded bg-red-100 px-2 py-1 text-xs text-red-600 active:bg-red-200"
                        >🗑️</button>
                      </li>
                    ))}
                  </ul>

                  <div className="border-t border-pink-100 px-3 py-2">
                    <button
                      onClick={() => openModal({ mode: "add-weekday", day: day.day })}
                      className="w-full rounded-lg border border-dashed border-pink-300 py-1.5 text-xs font-bold text-pink-600 active:bg-pink-100"
                    >
                      + Legg til oppgave
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Accordion: Bonusoppgaver ── */}
      <section className="mt-4 px-4">
        <button onClick={() => toggleSection("bonus")} className="flex w-full items-center justify-between rounded-xl bg-amber-100 px-4 py-3 text-left active:bg-amber-200">
          <span className="text-sm font-bold uppercase tracking-wider text-amber-700">Bonusoppgaver 💰</span>
          <span className="text-lg text-amber-400">{openSections.bonus ? "▲" : "▼"}</span>
        </button>

        {openSections.bonus && (
          <div className="mt-2">
            <ul className="space-y-2">
              {bonusTasks.map((b) => (
                <li key={b.id} className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                  <p className="min-w-0 flex-1 break-words text-sm text-gray-800">{b.title}</p>
                  <span className="shrink-0 rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-800">+kr {b.valueNok}</span>
                  {badge(b.approvalStatus)}

                  {b.approvalStatus === "pending" && (
                    <>
                      <button onClick={() => setApproval(b.id, "approved")} className="shrink-0 rounded bg-green-500 px-2 py-1 text-xs font-bold text-white">✅</button>
                      <button onClick={() => setApproval(b.id, "rejected")} className="shrink-0 rounded bg-red-400 px-2 py-1 text-xs font-bold text-white">❌</button>
                    </>
                  )}
                  {b.approvalStatus === "none" && !b.checkedByChild && (
                    <button onClick={() => childToggle(b.id)} className="shrink-0 rounded bg-amber-200 px-2 py-1 text-xs text-amber-700 active:bg-amber-300">Simuler</button>
                  )}
                  {b.approvalStatus === "rejected" && (
                    <button onClick={() => setApproval(b.id, "none")} className="shrink-0 rounded bg-gray-200 px-2 py-1 text-xs text-gray-600">Tilbakestill</button>
                  )}

                  <button
                    onClick={() => openModal({ mode: "edit-bonus", taskId: b.id, text: b.title, value: b.valueNok ?? 0, standardTaskId: b.standardTaskId })}
                    className="shrink-0 rounded bg-blue-100 px-2 py-1 text-xs text-blue-700 active:bg-blue-200"
                  >✏️</button>
                  <button
                    onClick={() => deleteTask(b.id)}
                    className="shrink-0 rounded bg-red-100 px-2 py-1 text-xs text-red-600 active:bg-red-200"
                  >🗑️</button>
                </li>
              ))}
            </ul>

            <button
              onClick={() => openModal({ mode: "add-bonus" })}
              className="mt-2 w-full rounded-lg border border-dashed border-amber-300 py-2 text-xs font-bold text-amber-700 active:bg-amber-100"
            >
              + Legg til bonusoppgave
            </button>
          </div>
        )}
      </section>

      {/* ── Accordion: Innstillinger ── */}
      <section className="mt-4 px-4">
        <button onClick={() => toggleSection("settings")} className="flex w-full items-center justify-between rounded-xl bg-gray-100 px-4 py-3 text-left active:bg-gray-200">
          <span className="text-sm font-bold uppercase tracking-wider text-gray-700">Innstillinger ⚙️</span>
          <span className="text-lg text-gray-400">{openSections.settings ? "▲" : "▼"}</span>
        </button>

        {openSections.settings && (
          <div className="mt-2 rounded-xl border border-gray-200 bg-white p-4">
            <label className="block text-sm font-bold text-gray-700">
              Ukelønn (baseAllowance)
              <div className="mt-1 flex items-center gap-2">
                <span className="text-sm text-gray-500">kr</span>
                <input
                  type="number"
                  min={0}
                  step={10}
                  value={baseAllowance}
                  onChange={(e) => setBaseAllowance(Math.max(0, Number(e.target.value) || 0))}
                  className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-pink-400"
                />
                <span className="text-sm text-gray-400">,–</span>
              </div>
            </label>
            <p className="mt-2 text-xs text-gray-500">
              Barnet må fullføre og få godkjent alle ukelønn-oppgaver for å tjene dette beløpet.
            </p>

            <div className="mt-5 border-t border-gray-200 pt-4">
              <h3 className="text-sm font-bold text-gray-800">PIN for barnesiden</h3>
              <p className="mt-1 text-xs text-gray-500">
                Status: {childPinConfigured ? "Aktiv" : "Ikke satt"}. PIN synkroniseres på tvers av enheter.
              </p>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={childPinInput}
                  onChange={(e) => setChildPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="Ny 4-sifret PIN"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-pink-400"
                />
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={childPinConfirm}
                  onChange={(e) => setChildPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="Gjenta PIN"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-pink-400"
                />
              </div>

              {childPinError && (
                <p className="mt-2 text-xs font-medium text-red-600">{childPinError}</p>
              )}
              {childPinMessage && (
                <p className="mt-2 text-xs font-medium text-green-700">{childPinMessage}</p>
              )}

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  disabled={childPinBusy}
                  onClick={() => void handleSaveChildPin()}
                  className="rounded-lg bg-pink-500 px-4 py-2 text-sm font-bold text-white active:bg-pink-600 disabled:opacity-50"
                >
                  {childPinConfigured ? "Endre PIN" : "Lagre PIN"}
                </button>
                <button
                  type="button"
                  disabled={childPinBusy || !childPinConfigured}
                  onClick={() => void handleResetChildPin()}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 active:bg-gray-100 disabled:opacity-50"
                >
                  Fjern PIN
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── Saldo + Sparemål ── */}
      <div className="mt-4 grid grid-cols-1 px-4 md:grid-cols-[1fr_1fr] md:gap-4">

        {/* ── Saldo ── */}
        <section className="flex flex-col items-center gap-3 rounded-xl border border-purple-200 bg-purple-50 p-4 md:p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-purple-600 md:text-base">
            Saldo 🏦
          </h2>
          <p className="text-xs text-purple-500">Penger på konto nå</p>
          <p className="text-4xl font-extrabold text-purple-900">kr {balance},–</p>
          <div className="flex w-full gap-2">
            <input
              type="number"
              min="0"
              step={10}
              placeholder="Ny saldo"
              value={balanceInput}
              onChange={(e) => setBalanceInput(e.target.value)}
              className="w-full rounded-lg border border-purple-200 px-3 py-2 text-center text-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
            <button
              type="button"
              onClick={() => {
                const val = Math.max(0, Number(balanceInput) || 0);
                void setBalance(val);
                setBalanceInput("");
              }}
              className="shrink-0 rounded-lg bg-purple-500 px-5 py-2 font-bold text-white transition hover:bg-purple-600"
            >
              Oppdater
            </button>
          </div>
        </section>

        {/* ── Sparemål ── */}
        <section className="mt-4 rounded-xl border border-teal-200 bg-teal-50 p-4 md:mt-0 md:p-5">
          <h2 className="mb-3 text-center text-sm font-bold uppercase tracking-wider text-teal-600 md:text-base">
            Sparer til 🎯
          </h2>

          <div className="space-y-3">
            {goals.map((goal, i) => {
              const pct = goal.price > 0 ? Math.min(100, (balance / goal.price) * 100) : 0;
              const weeks = goal.price > 0 ? weeksNeeded(goal.price) : 0;
              const reached = goal.price > 0 && balance >= goal.price;
              return (
                <div key={i} className="rounded-xl bg-white/80 p-3">
                  <p className="mb-1 text-xs font-bold uppercase tracking-wider text-teal-500">
                    {i + 1}. prioritet
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Hva spares det til?"
                      value={goal.name}
                      onChange={(e) => updateGoal(i, "name", e.target.value)}
                      className="w-full rounded-lg border border-teal-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                    />
                    <div className="relative">
                      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">kr</span>
                      <input
                        type="number"
                        min="0"
                        step={10}
                        placeholder="Pris"
                        value={goal.price || ""}
                        onChange={(e) => updateGoal(i, "price", e.target.value)}
                        className="w-24 rounded-lg border border-teal-200 py-2 pl-7 pr-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                      />
                    </div>
                  </div>

                  {goal.name && goal.price > 0 && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs text-teal-700">
                        <span>kr {Math.min(balance, goal.price)},– / {goal.price},–</span>
                        <span className="font-bold">{Math.round(pct)}%</span>
                      </div>
                      <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-teal-200">
                        <div
                          className={`h-full rounded-full transition-all ${reached ? "bg-green-400" : "bg-teal-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="mt-1 text-center text-xs text-teal-600">
                        {reached ? (
                          <span className="font-bold text-green-600">🎉 Nok spart!</span>
                        ) : (
                          <>~{weeks} {weeks === 1 ? "uke" : "uker"} med ukelønn igjen</>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* ── Sync info ── */}
      <p className="mt-8 px-4 text-center text-xs text-gray-400">
        Data synkroniseres i sanntid via Firestore. Endringer på barnesiden vises umiddelbart her.
      </p>

      {/* ── Bottom sheet modal ── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setModal(null)}>
          <div
            className="w-full max-w-lg animate-[slideUp_0.2s_ease-out] rounded-t-2xl bg-white px-4 pb-6 pt-3 shadow-xl md:mb-auto md:mt-auto md:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-300 md:hidden" />

            <h2 className="mb-4 text-base font-bold text-gray-900">
              {modal.mode === "add-weekday" && `Ny oppgave – ${modal.day}`}
              {modal.mode === "edit-weekday" && "Rediger oppgave"}
              {modal.mode === "add-bonus" && "Ny bonusoppgave"}
              {modal.mode === "edit-bonus" && "Rediger bonusoppgave"}
            </h2>

            <label className="block text-sm font-medium text-gray-700">
              Oppgavetekst
              <input
                autoFocus
                type="text"
                value={modalText}
                onChange={(e) => setModalText(e.target.value)}
                placeholder="F.eks. Rydde rommet"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
              />
            </label>

            {isBonus && (
              <label className="mt-3 block text-sm font-medium text-gray-700">
                Beløp (kr)
                <input
                  type="number"
                  min={1}
                  step={10}
                  value={modalValue}
                  onChange={(e) => setModalValue(e.target.value)}
                  placeholder="10"
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </label>
            )}

            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={modalIsStandard}
                onChange={(e) => setModalIsStandard(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 accent-pink-500"
              />
              Standardoppgave
            </label>

            <div className="mt-5 flex gap-3">
              <button
                onClick={saveModal}
                disabled={!modalText.trim()}
                className="flex-1 rounded-lg bg-pink-500 py-2.5 text-sm font-bold text-white active:bg-pink-600 disabled:opacity-40"
              >
                {modal.mode.startsWith("add") ? "Legg til" : "Lagre"}
              </button>
              <button
                onClick={() => setModal(null)}
                className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 active:bg-gray-100"
              >
                Avbryt
              </button>
            </div>
          </div>
        </div>
      )}

      <ActivateNotificationsButton role="parent" />

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </main>
  );
}
