"use client";

import { useState } from "react";
import { useTaskStore } from "@/lib/TaskContext";

export default function ChildPage() {
  const {
    dayGroups,
    bonusTasks,
    baseAllowance,
    totalWeekly,
    allWeeklyApproved,
    baseEarned,
    maxBonus,
    approvedBonusSum,
    totalEarned,
    childToggle,
  } = useTaskStore();

  const [balance, setBalance] = useState(0);
  const [balanceInput, setBalanceInput] = useState("");
  const [goals, setGoals] = useState<{ name: string; price: number }[]>([
    { name: "", price: 0 },
    { name: "", price: 0 },
    { name: "", price: 0 },
  ]);

  const doneCount = dayGroups
    .flatMap((d) => d.tasks)
    .filter((t) => t.checkedByChild).length;

  // Bonus: child sees sum of bonus tasks they checked (regardless of approval)
  const bonusCheckedSum = bonusTasks
    .filter((b) => b.checkedByChild)
    .reduce((sum, b) => sum + (b.valueNok ?? 0), 0);

  // For the child view, show "earned" based on approvals
  const childTotalEarned = totalEarned;

  function updateGoal(index: number, field: "name" | "price", value: string) {
    setGoals((prev) =>
      prev.map((g, i) =>
        i === index
          ? { ...g, [field]: field === "price" ? Math.max(0, Number(value) || 0) : value }
          : g
      )
    );
  }

  function weeksNeeded(price: number) {
    const remaining = Math.max(0, price - balance);
    return Math.ceil(remaining / baseAllowance);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6 md:px-8 md:py-8">
      {/* ─── Top banner ─── */}
      <header className="rounded-t-2xl bg-pink-400 px-6 py-4 text-center md:py-5">
        <h1 className="text-2xl font-extrabold uppercase tracking-wide text-white md:text-3xl">
          Almas ukelønn ✅
        </h1>
        <p className="mt-1 text-sm text-pink-100 md:text-base">
          Gjør alle oppgavene → <span className="font-bold text-white">kr {baseAllowance},–</span> + opptil <span className="font-bold text-white">kr {maxBonus},–</span> i bonus!
        </p>
      </header>

      {/* ─── Dashboard ─── */}
      <div className="overflow-hidden rounded-b-2xl shadow-lg">

        {/* ── Oppgaver (full bredde, egen rad) ── */}
        <section className="bg-pink-50 p-4 md:p-6">
          <h2 className="text-center text-sm font-bold uppercase tracking-wider text-pink-600 md:text-base">
            Ukelønn‑oppgaver (låser opp kr {baseAllowance} ✅)
          </h2>
          <p className="mb-3 mt-1 text-center text-xs text-pink-500 md:text-sm">
            Gjør alle for å få ukelønn – bonus kommer i tillegg 💪
          </p>

          {/*
            Day cards grid — tablet-first: 2 cols default, 3 on md
            (iPad portrait), 5 on xl (landscape / Chromebook).
            min-w-[170px] on each card prevents text from being
            squeezed too narrow.
          */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
            {dayGroups.map((day) => {
              const dayDone = day.tasks.every((t) => t.checkedByChild);
              return (
                <div
                  key={day.day}
                  className={`min-w-[170px] overflow-hidden rounded-xl border ${
                    dayDone ? "border-green-300 bg-green-50" : "border-pink-200 bg-white"
                  }`}
                >
                  {/* Day header */}
                  <div className={`flex items-center justify-between px-3 py-2 ${
                    dayDone ? "bg-green-100" : "bg-pink-100"
                  }`}>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-pink-700">
                      {day.day}
                    </h3>
                    {dayDone && <span className="text-sm text-green-500">✓</span>}
                  </div>

                  {/*
                    Task row layout: grid-cols-[1fr_auto] ensures
                    - min-w-0 on text: allows text to shrink below its
                      intrinsic width so word-wrap kicks in instead of
                      overflowing or doing letter-by-letter breaks.
                    - break-words: wraps long words gracefully.
                    - shrink-0 on toggle: the switch never gets compressed
                      or pushed off-screen regardless of text length.
                  */}
                  <ul className="space-y-2 p-3">
                    {day.tasks.map((item) => {
                      const isDone = item.checkedByChild;
                      const checkboxId = `task-${item.id}`;
                      return (
                        <li key={item.id}>
                          <label
                            htmlFor={checkboxId}
                            className={`grid cursor-pointer grid-cols-[1fr_auto] items-start gap-3 rounded-xl border px-3 py-2.5 transition hover:bg-pink-50 ${
                              isDone
                                ? "border-green-200 bg-green-50/50"
                                : "border-pink-200 bg-white/60"
                            }`}
                          >
                            <input
                              id={checkboxId}
                              type="checkbox"
                              checked={isDone}
                              onChange={() => childToggle(item.id)}
                              className="sr-only"
                            />
                            <span className="min-w-0 whitespace-normal break-words">
                              <span
                                className={`text-sm leading-snug ${
                                  isDone ? "text-pink-300 line-through" : "text-pink-900"
                                }`}
                              >
                                {item.title}
                              </span>
                              {item.subtitle && (
                                <span className="mt-0.5 block text-xs leading-tight text-pink-400">
                                  {item.subtitle}
                                </span>
                              )}
                            </span>
                            <span
                              aria-hidden="true"
                              className={`mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                                isDone ? "bg-green-400" : "bg-pink-200"
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                                  isDone ? "translate-x-6" : "translate-x-1"
                                }`}
                              />
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="mt-3">
            <div className="h-3 w-full overflow-hidden rounded-full bg-pink-200">
              <div
                className="h-full rounded-full bg-green-400 transition-all"
                style={{ width: `${totalWeekly > 0 ? (doneCount / totalWeekly) * 100 : 0}%` }}
              />
            </div>
            <p className="mt-1 text-center text-sm font-bold text-pink-800">
              {doneCount} av {totalWeekly} gjort
              {allWeeklyApproved && " — 🎉 Ukelønn opptjent!"}
            </p>
          </div>

          {/* Tips */}
          <p className="mt-2 rounded-lg bg-yellow-50 px-3 py-2 text-center text-xs text-yellow-700 md:text-sm">
            <strong>Husk:</strong> Forelder må godkjenne før det teller som ukelønn 💰
          </p>
        </section>

        {/* ── Bonusoppgaver ── */}
        <section className="border-t border-amber-200 bg-amber-50 p-4 md:p-6">
          <h2 className="mb-1 text-center text-sm font-bold uppercase tracking-wider text-amber-700 md:text-base">
            Bonusoppgaver 💰 <span className="normal-case tracking-normal">(tjen ekstra!)</span>
          </h2>
          <p className="mb-3 text-center text-xs text-amber-600 md:text-sm">
            Du kan tjene <strong>+kr {maxBonus},–</strong> ekstra – akkurat nå: <strong className="text-green-600">+kr {bonusCheckedSum},–</strong>
          </p>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {bonusTasks.map((b) => {
              const checked = b.checkedByChild;
              const cbId = `bonus-${b.id}`;
              return (
                <label
                  key={b.id}
                  htmlFor={cbId}
                  className={`grid cursor-pointer grid-cols-[1fr_auto_auto] items-start gap-2 rounded-xl border px-3 py-2.5 transition hover:bg-amber-100 ${
                    checked
                      ? "border-green-300 bg-green-50/60"
                      : "border-amber-200 bg-white/70"
                  }`}
                >
                  <input
                    id={cbId}
                    type="checkbox"
                    checked={checked}
                    onChange={() => childToggle(b.id)}
                    className="sr-only"
                  />
                  <span
                    className={`min-w-0 whitespace-normal break-words text-sm leading-snug ${
                      checked ? "text-amber-400 line-through" : "text-amber-900"
                    }`}
                  >
                    {b.title}
                  </span>
                  <span className="mt-0.5 shrink-0 rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-800">
                    +kr {b.valueNok}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                      checked ? "bg-green-400" : "bg-amber-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                        checked ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </span>
                </label>
              );
            })}
          </div>
        </section>

        {/* ── Total opptjent denne uka ── */}
        <section className="border-t border-green-200 bg-green-50 px-4 py-4 text-center md:px-6">
          {totalEarned > 0 ? (
            <p className="text-lg font-bold text-green-900 md:text-xl">
              YES! Denne uka blir det <span className="text-2xl text-green-800 md:text-3xl">kr {childTotalEarned},–</span> 🎉
              <span className="mt-0.5 block text-sm font-normal text-green-700">
                kr {baseEarned},– <span className="text-green-600">(ukelønn)</span> + kr {approvedBonusSum},– <span className="text-amber-600">(bonus)</span>
              </span>
            </p>
          ) : (
            <p className="text-lg font-bold text-green-900 md:text-xl">
              Denne uka: kr {baseEarned},– <span className="text-green-700">(ukelønn)</span> + kr {approvedBonusSum},– <span className="text-amber-600">(bonus)</span> = <span className="text-2xl text-green-800 md:text-3xl">kr {childTotalEarned},–</span>
            </p>
          )}
          <p className="mt-1 text-sm text-green-700">
            {baseEarned === 0
              ? `Gjør ferdig ukens oppgaver for å låse opp kr ${baseAllowance} – bonus kommer i tillegg 💪`
              : approvedBonusSum === 0
                ? "Vil du tjene mer? Ta en bonusoppgave og få ekstra 💰"
                : `Nice! Du har økt ukelønna med kr ${approvedBonusSum} denne uka! 🎉`}
          </p>
        </section>

        {/* ── Saldo + Sparemål side by side ── */}
        <div className="grid grid-cols-1 border-t border-pink-200 md:grid-cols-[1fr_1fr]">

        {/* ── Saldo ── */}
        <section className="flex flex-col items-center gap-3 bg-purple-50 p-4 md:border-r md:border-pink-200 md:p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-purple-600 md:text-base">
            Min saldo 🏦
          </h2>
          <p className="text-xs text-purple-500">Penger på konto nå</p>
          <p className="text-4xl font-extrabold text-purple-900">kr {balance},–</p>
          <div className="flex w-full gap-2">
            <input
              type="number"
              min="0"
              placeholder="Ny saldo"
              value={balanceInput}
              onChange={(e) => setBalanceInput(e.target.value)}
              className="w-full rounded-lg border border-purple-200 px-3 py-2 text-center text-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
            <button
              type="button"
              onClick={() => {
                const val = Math.max(0, Number(balanceInput) || 0);
                setBalance(val);
                setBalanceInput("");
              }}
              className="shrink-0 rounded-lg bg-purple-500 px-5 py-2 font-bold text-white transition hover:bg-purple-600"
            >
              Oppdater
            </button>
          </div>
        </section>

        {/* ── Sparemål ── */}
        <section className="bg-teal-50 p-4 md:p-5">
          <h2 className="mb-3 text-center text-sm font-bold uppercase tracking-wider text-teal-600 md:text-base">
            Jeg sparer til 🎯
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
                      placeholder="Hva sparer du til?"
                      value={goal.name}
                      onChange={(e) => updateGoal(i, "name", e.target.value)}
                      className="w-full rounded-lg border border-teal-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                    />
                    <div className="relative">
                      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">kr</span>
                      <input
                        type="number"
                        min="0"
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
                          <span className="font-bold text-green-600">🎉 Du har nok!</span>
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

        </div>{/* end saldo + sparemål row */}
      </div>{/* end dashboard */}
    </main>
  );
}
