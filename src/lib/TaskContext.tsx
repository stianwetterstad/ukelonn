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

// ─── Context value type ─────────────────────────────────────────────────────
type TaskStore = {
  tasks: Task[];
  baseAllowance: number;

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

  // CRUD (parent)
  addTask: (task: Omit<Task, "id" | "checkedByChild" | "approvalStatus">) => void;
  editTask: (id: string, updates: Partial<Pick<Task, "title" | "valueNok" | "subtitle">>) => void;
  deleteTask: (id: string) => void;

  // Admin
  seedInitialTasks: () => Promise<void>;
  resetAllData: () => Promise<void>;
};

const TaskContext = createContext<TaskStore | null>(null);

// ─── Provider ───────────────────────────────────────────────────────────────
export function TaskProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [baseAllowance, setBaseAllowanceLocal] = useState(INITIAL_BASE_ALLOWANCE);

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
          };
        });
        setTasks(mapped);
      },
    );

    const unsubSettings = onSnapshot(
      doc(db, "families", FAMILY_ID, "settings", "main"),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (typeof data.baseAllowance === "number") {
            setBaseAllowanceLocal(data.baseAllowance);
          }
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
      doc(db, "families", FAMILY_ID, "settings", "main"),
      { baseAllowance: value },
      { merge: true },
    );
  }, []);

  // ── CRUD ──
  const addTask = useCallback(
    (partial: Omit<Task, "id" | "checkedByChild" | "approvalStatus">) => {
      addDoc(collection(db, "families", FAMILY_ID, "tasks"), {
        ...partial,
        checkedByChild: false,
        approvalStatus: "none",
      });
    },
    [],
  );

  const editTask = useCallback(
    (id: string, updates: Partial<Pick<Task, "title" | "valueNok" | "subtitle">>) => {
      updateDoc(taskDocRef(id), updates);
    },
    [],
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
    deletes.push(deleteDoc(doc(db, "families", FAMILY_ID, "settings", "main")));
    await Promise.all(deletes);
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
      addTask,
      editTask,
      deleteTask,
      seedInitialTasks,
      resetAllData,
    };
  }, [tasks, baseAllowance, childToggle, setApproval, approveAllPending, setBaseAllowance, addTask, editTask, deleteTask, seedInitialTasks, resetAllData]);

  return <TaskContext value={store}>{children}</TaskContext>;
}

// ─── Hook ───────────────────────────────────────────────────────────────────
export function useTaskStore(): TaskStore {
  const ctx = useContext(TaskContext);
  if (!ctx) throw new Error("useTaskStore must be used within a TaskProvider");
  return ctx;
}
