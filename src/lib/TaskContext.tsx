"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  setDoc,
  getDocs,
  deleteField,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { seedInitialTasks as seedInitialTasksFn } from "@/lib/seedInitialTasks";
import {
  INITIAL_BASE_ALLOWANCE,
  groupByDay,
  type Task,
  type ApprovalStatus,
} from "@/lib/tasks";

const FAMILY_ID = "family-default";

function taskDocRef(id: string) {
  return doc(db, "families", FAMILY_ID, "tasks", id);
}

function settingsDocRef() {
  return doc(db, "families", FAMILY_ID, "settings", "main");
}

// ─── Context value type ─────────────────────────────────────────────────────
type TaskStore = {
  tasks: Task[];
  baseAllowance: number;
  balance: number;
  savingsGoal: string;

  // Derived
  weeklyTasks: Task[];
  bonusTasks: Task[];
  dayGroups: ReturnType<typeof groupByDay>;
  totalWeekly: number;
  approvedWeeklyCount: number;
  allWeeklyApproved: boolean;
  baseEarned: number;
  maxBonus: number;
  approvedBonusSum: number;
  totalEarned: number;

  // Child actions
  childToggle: (id: string) => void;

  // Parent actions
  setApproval: (id: string, status: ApprovalStatus) => void;
  approveAllPending: () => void;
  setBaseAllowance: (value: number) => void;
  setBalance: (value: number) => Promise<void>;
  setSavingsGoal: (value: string) => Promise<void>;

  // CRUD (parent)
  addTask: (task: Omit<Task, "id" | "checkedByChild" | "approvalStatus">) => Promise<string>;
  editTask: (id: string, updates: Partial<Pick<Task, "title" | "valueNok" | "subtitle">>) => Promise<void>;
  deleteTask: (id: string) => void;

  // Standard task helpers
  upsertStandardTask: (task: Task) => Promise<string>;
  removeStandardTask: (standardTaskId: string, taskId: string) => Promise<void>;

  // Admin
  seedInitialTasks: () => Promise<void>;
  resetAllData: () => Promise<void>;
};

const TaskContext = createContext<TaskStore | null>(null);

// ─── Provider ───────────────────────────────────────────────────────────────
export function TaskProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [baseAllowance, setBaseAllowanceLocal] = useState(INITIAL_BASE_ALLOWANCE);
  const [balance, setBalanceLocal] = useState(0);
  const [savingsGoal, setSavingsGoalLocal] = useState("");

  // ── Firestore realtime listeners ──
  // Firestore brukes som source of truth og gir realtime sync:
  // endringer på én enhet (f.eks. /child) vises umiddelbart på andre
  // enheter (f.eks. /parent) via onSnapshot-lyttere.
  useEffect(() => {
    const unsubTasks = onSnapshot(
      collection(db, "families", FAMILY_ID, "tasks"),
      (snap) => {
        const mapped: Task[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            title: data.title as string,
            type: data.type as Task["type"],
            day: data.day as string | undefined,
            subtitle: data.subtitle as string | undefined,
            valueNok: data.valueNok as number | undefined,
            checkedByChild: data.checkedByChild as boolean,
            approvalStatus: (data.approvalStatus as ApprovalStatus) ?? "none",
            standardTaskId: data.standardTaskId as string | undefined,
          };
        });
        setTasks(mapped);
      },
    );

    const unsubSettings = onSnapshot(
      settingsDocRef(),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (typeof data.baseAllowance === "number") {
            setBaseAllowanceLocal(data.baseAllowance);
          }
          setBalanceLocal(typeof data.balance === "number" ? data.balance : 0);
          setSavingsGoalLocal(typeof data.savingsGoal === "string" ? data.savingsGoal : "");
        } else {
          setBalanceLocal(0);
          setSavingsGoalLocal("");
        }
      },
    );

    return () => {
      unsubTasks();
      unsubSettings();
    };
  }, []);

  // ── Child action: toggle ──
  const childToggle = useCallback(
    (id: string) => {
      const task = tasks.find((t) => t.id === id);
      if (!task) return;
      if (task.checkedByChild) {
        updateDoc(taskDocRef(id), { checkedByChild: false, approvalStatus: "none" });
      } else {
        updateDoc(taskDocRef(id), { checkedByChild: true, approvalStatus: "pending" });
      }
    },
    [tasks],
  );

  // ── Parent action: approve/reject ──
  const setApproval = useCallback((id: string, status: ApprovalStatus) => {
    updateDoc(taskDocRef(id), { approvalStatus: status });
  }, []);

  const approveAllPending = useCallback(() => {
    tasks
      .filter((t) => t.approvalStatus === "pending")
      .forEach((t) => updateDoc(taskDocRef(t.id), { approvalStatus: "approved" }));
  }, [tasks]);

  // ── Base allowance → Firestore ──
  const setBaseAllowance = useCallback((value: number) => {
    setDoc(
      settingsDocRef(),
      { baseAllowance: value },
      { merge: true },
    );
  }, []);

  const setBalance = useCallback(async (value: number) => {
    const nextValue = Math.max(0, Number(value) || 0);
    setBalanceLocal(nextValue);
    await setDoc(settingsDocRef(), { balance: nextValue }, { merge: true });
  }, []);

  const setSavingsGoal = useCallback(async (value: string) => {
    setSavingsGoalLocal(value);
    await setDoc(settingsDocRef(), { savingsGoal: value }, { merge: true });
  }, []);

  // ── Standard task helpers ──
  const upsertStandardTask = useCallback(async (task: Task): Promise<string> => {
    const standardTasksRef = collection(db, "families", FAMILY_ID, "standardTasks");
    const standardDoc: Record<string, unknown> = {
      title: task.title,
      type: task.type,
    };
    if (task.day !== undefined) standardDoc.day = task.day;
    if (task.subtitle !== undefined) standardDoc.subtitle = task.subtitle;
    if (task.valueNok !== undefined) standardDoc.valueNok = task.valueNok;

    if (task.standardTaskId) {
      await setDoc(doc(standardTasksRef, task.standardTaskId), standardDoc, { merge: true });
      return task.standardTaskId;
    } else {
      const newRef = await addDoc(standardTasksRef, standardDoc);
      await updateDoc(taskDocRef(task.id), { standardTaskId: newRef.id });
      return newRef.id;
    }
  }, []);

  const removeStandardTask = useCallback(async (standardTaskId: string, taskId: string): Promise<void> => {
    await deleteDoc(doc(db, "families", FAMILY_ID, "standardTasks", standardTaskId));
    await updateDoc(taskDocRef(taskId), { standardTaskId: deleteField() });
  }, []);

  // ── CRUD ──
  const addTask = useCallback(
    async (partial: Omit<Task, "id" | "checkedByChild" | "approvalStatus">): Promise<string> => {
      const ref = await addDoc(collection(db, "families", FAMILY_ID, "tasks"), {
        ...partial,
        source: "manual",
        checkedByChild: false,
        approvalStatus: "none",
      });
      return ref.id;
    },
    [],
  );

  const editTask = useCallback(
    async (id: string, updates: Partial<Pick<Task, "title" | "valueNok" | "subtitle">>) => {
      await updateDoc(taskDocRef(id), updates);
      const task = tasks.find((t) => t.id === id);
      if (task?.standardTaskId) {
        const standardUpdates: Record<string, unknown> = {};
        if (updates.title !== undefined) standardUpdates.title = updates.title;
        if (updates.valueNok !== undefined) standardUpdates.valueNok = updates.valueNok;
        if (updates.subtitle !== undefined) standardUpdates.subtitle = updates.subtitle;
        if (Object.keys(standardUpdates).length > 0) {
          await updateDoc(
            doc(db, "families", FAMILY_ID, "standardTasks", task.standardTaskId),
            standardUpdates,
          );
        }
      }
    },
    [tasks],
  );

  const deleteTask = useCallback((id: string) => {
    deleteDoc(taskDocRef(id));
  }, []);

  // ── Admin actions ──
  const seedInitialTasks = useCallback(async () => {
    if (tasks.length > 0) return;
    await seedInitialTasksFn();
  }, [tasks.length]);

  const resetAllData = useCallback(async () => {
    const tasksSnap = await getDocs(collection(db, "families", FAMILY_ID, "tasks"));
    const deletes = tasksSnap.docs.map((d) => deleteDoc(d.ref));
    await Promise.all(deletes);

await setDoc(
  settingsDocRef(),
  { baseAllowance: INITIAL_BASE_ALLOWANCE, balance: 0, savingsGoal: "" },
  { merge: true },
);
  }, []);

  // ── Derived ──
  const store = useMemo<TaskStore>(() => {
    const weeklyTasks = tasks.filter((t) => t.type === "weekly");
    const bonusTasks = tasks.filter((t) => t.type === "bonus");
    const dayGroups = groupByDay(tasks);

    const totalWeekly = weeklyTasks.length;
    const approvedWeeklyCount = weeklyTasks.filter(
      (t) => t.approvalStatus === "approved",
    ).length;
    const allWeeklyApproved = totalWeekly > 0 && approvedWeeklyCount === totalWeekly;
    const baseEarned = allWeeklyApproved ? baseAllowance : 0;

    const maxBonus = bonusTasks.reduce((s, b) => s + (b.valueNok ?? 0), 0);
    const approvedBonusSum = bonusTasks
      .filter((b) => b.approvalStatus === "approved")
      .reduce((s, b) => s + (b.valueNok ?? 0), 0);

    const totalEarned = baseEarned + approvedBonusSum;

    return {
      tasks,
      baseAllowance,
      balance,
      savingsGoal,
      weeklyTasks,
      bonusTasks,
      dayGroups,
      totalWeekly,
      approvedWeeklyCount,
      allWeeklyApproved,
      baseEarned,
      maxBonus,
      approvedBonusSum,
      totalEarned,
      childToggle,
      setApproval,
      approveAllPending,
      setBaseAllowance,
      setBalance,
      setSavingsGoal,
      addTask,
      editTask,
      deleteTask,
      upsertStandardTask,
      removeStandardTask,
      seedInitialTasks,
      resetAllData,
    };
  }, [tasks, baseAllowance, balance, savingsGoal, childToggle, setApproval, approveAllPending, setBaseAllowance, setBalance, setSavingsGoal, addTask, editTask, deleteTask, upsertStandardTask, removeStandardTask, seedInitialTasks, resetAllData]);

  return <TaskContext.Provider value={store}>{children}</TaskContext.Provider>;
}

// Hook
export function useTaskStore(): TaskStore {
  const ctx = useContext(TaskContext);
  if (!ctx) throw new Error("useTaskStore must be used within a TaskProvider");
  return ctx;
}


