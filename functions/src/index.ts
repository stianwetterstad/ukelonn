import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import type { BatchResponse, SendResponse } from "firebase-admin/messaging";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import type { DocumentData } from "firebase-admin/firestore";
import { onDocumentCreated, onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";

initializeApp();
const db = getFirestore();
const messaging = getMessaging();

const FAMILY_ID = "family-default";
// Keep all 2nd gen functions in the same region so Eventarc trigger validation matches.
const FUNCTION_REGION = "europe-west4";
const OSLO_TIME_ZONE = "Europe/Oslo";
const APP_BASE_PATH = "/ukelonn";

type DeviceRole = "parent" | "child";

type TaskDocument = {
  title?: string;
  type?: "weekly" | "bonus";
  day?: string;
  valueNok?: number;
  checkedByChild?: boolean;
  approvalStatus?: "none" | "pending" | "approved" | "rejected";
  source?: "seed" | "manual";
  seeded?: boolean;
};

type ApprovalStatus = NonNullable<TaskDocument["approvalStatus"]>;

type PushOptions = {
  link?: string;
  data?: Record<string, string>;
};

const INVALID_TOKEN_ERROR_CODES = new Set<string>([
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
]);

function getInvalidTokens(tokens: string[], response: BatchResponse): string[] {
  return response.responses
    .map((resp: SendResponse, idx: number) => {
      if (!resp.success && resp.error && INVALID_TOKEN_ERROR_CODES.has(resp.error.code)) {
        return tokens[idx];
      }
      return null;
    })
    .filter((token): token is string => token !== null);
}

function mapOsloWeekdayToTaskDay(now = new Date()): string | null {
  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: OSLO_TIME_ZONE,
  }).format(now);

  const map: Record<string, string> = {
    Mon: "Mandag",
    Tue: "Tirsdag",
    Wed: "Onsdag",
    Thu: "Torsdag",
    Fri: "Fredag",
  };

  return map[weekday] ?? null;
}

// ─── Send push notification to all parent devices ─────────────────────────
async function sendPushToRole(
  familyId: string,
  role: DeviceRole,
  title: string,
  body: string,
  options: PushOptions = {}
): Promise<void> {
  try {
    // Get all devices for a given role in the family.
    const devicesSnap = await db
      .collection("families")
      .doc(familyId)
      .collection("devices")
      .where("role", "==", role)
      .get();

    if (devicesSnap.empty) {
      console.log(`No ${role} devices found for family ${familyId}`);
      return;
    }

    const tokens = devicesSnap.docs
      .map((docSnap: QueryDocumentSnapshot<DocumentData>) => docSnap.data().token as string)
      .filter((token) => Boolean(token));

    if (tokens.length === 0) {
      console.log(`No valid ${role} tokens found for family ${familyId}`);
      return;
    }

    const mergedData = {
      ...(options.data ?? {}),
      ...(options.link ? { link: options.link } : {}),
    };

    // Send multicast message with modern Admin SDK API.
    const response = await messaging.sendEachForMulticast({
      notification: {
        title,
        body,
      },
      ...(Object.keys(mergedData).length > 0 ? { data: mergedData } : {}),
      webpush: {
        notification: {
          title,
          body,
          icon: "/icon-192.png",
          badge: "/icon-192.png",
        },
        ...(options.link ? { fcmOptions: { link: options.link } } : {}),
      },
      tokens,
    });

    console.log(
      `Sent ${role} notification for family ${familyId}: ${response.successCount} success, ${response.failureCount} failed`
    );

    // Remove invalid tokens from Firestore.
    if (response.failureCount > 0) {
      const invalidTokens = getInvalidTokens(tokens, response);
      for (const token of invalidTokens) {
        await db.collection("families").doc(familyId).collection("devices").doc(token).delete();
      }
      if (invalidTokens.length > 0) {
        console.log(`Removed ${invalidTokens.length} invalid ${role} tokens for family ${familyId}`);
      }
    }
  } catch (error) {
    console.error(`Failed to send ${role} push notification for family ${familyId}:`, error);
    throw error;
  }
}

async function sendPushToParents(
  familyId: string,
  title: string,
  body: string,
  options: PushOptions = {}
): Promise<void> {
  await sendPushToRole(familyId, "parent", title, body, options);
}

async function sendPushToChildren(
  familyId: string,
  title: string,
  body: string,
  options: PushOptions = {}
): Promise<void> {
  await sendPushToRole(familyId, "child", title, body, options);
}

function getTaskLabel(task: TaskDocument | undefined, fallback = "En oppgave"): string {
  const title = task?.title?.trim();
  if (title) {
    return title;
  }
  return fallback;
}

function changedToStatus(
  before: TaskDocument | undefined,
  after: TaskDocument | undefined,
  targetStatus: ApprovalStatus
): boolean {
  return before?.approvalStatus !== targetStatus && after?.approvalStatus === targetStatus;
}

function isWeeklyTaskApproved(task: TaskDocument | undefined): boolean {
  if (!task) {
    return false;
  }

  return (
    task.type === "weekly" &&
    task.checkedByChild === true &&
    task.approvalStatus === "approved"
  );
}

// ─── Firestore trigger: When task status changes to "pending" ──────────────
export const onTaskPendingApproval = onDocumentWritten(
  {
    region: FUNCTION_REGION,
    document: "families/{familyId}/tasks/{taskId}",
  },
  async (event) => {
    const { familyId } = event.params;

    // Only for default family
    if (familyId !== FAMILY_ID) {
      return;
    }

    const before = event.data?.before.data();
    const after = event.data?.after.data();

    // Notify parent when child marks a task as pending approval.
    if (changedToStatus(before, after, "pending")) {
      const taskLabel = getTaskLabel(after, "En oppgave");
      console.log("Task marked as pending approval:", event.params.taskId);

      await sendPushToParents(
        familyId,
        "Ny oppgave til godkjenning",
        `${taskLabel} er klar for godkjenning.`,
        { link: `${APP_BASE_PATH}/parent/#pending-approval` }
      );
    }
  }
);

// ─── Firestore trigger: Notify child when parent approves/rejects ─────────
export const onTaskReviewedByParent = onDocumentWritten(
  {
    region: FUNCTION_REGION,
    document: "families/{familyId}/tasks/{taskId}",
  },
  async (event) => {
    const { familyId, taskId } = event.params;

    if (familyId !== FAMILY_ID) {
      return;
    }

    const before = event.data?.before.data() as TaskDocument | undefined;
    const after = event.data?.after.data() as TaskDocument | undefined;

    if (!after) {
      return;
    }

    const taskLabel = getTaskLabel(after, "Oppgaven");

    if (changedToStatus(before, after, "approved")) {
      console.log("Task approved by parent:", taskId);
      await sendPushToChildren(
        familyId,
        "Oppgave godkjent ✅",
        `${taskLabel} ble godkjent.`,
        { link: `${APP_BASE_PATH}/child/#weekly-tasks` }
      );
      return;
    }

    if (changedToStatus(before, after, "rejected")) {
      console.log("Task rejected by parent:", taskId);
      await sendPushToChildren(
        familyId,
        "Oppgave trenger nytt forsok 🔁",
        `${taskLabel} ble ikke godkjent ennå.`,
        { link: `${APP_BASE_PATH}/child/#weekly-tasks` }
      );
    }
  }
);

// ─── Firestore trigger: Notify child when all weekly tasks are approved ───
export const onWeeklyAllowanceUnlocked = onDocumentWritten(
  {
    region: FUNCTION_REGION,
    document: "families/{familyId}/tasks/{taskId}",
  },
  async (event) => {
    const { familyId, taskId } = event.params;

    if (familyId !== FAMILY_ID) {
      return;
    }

    const before = event.data?.before.data() as TaskDocument | undefined;
    const after = event.data?.after.data() as TaskDocument | undefined;

    // No meaningful transition for weekly approval state.
    if (!before && !after) {
      return;
    }

    const weeklyTasksSnap = await db
      .collection("families")
      .doc(familyId)
      .collection("tasks")
      .where("type", "==", "weekly")
      .get();

    if (weeklyTasksSnap.empty) {
      return;
    }

    let beforeAllApproved = true;
    let afterAllApproved = true;

    for (const taskDoc of weeklyTasksSnap.docs) {
      const currentTask = taskDoc.data() as TaskDocument;

      const beforeTask = taskDoc.id === taskId ? before : currentTask;
      const afterTask = taskDoc.id === taskId ? after : currentTask;

      if (!isWeeklyTaskApproved(beforeTask)) {
        beforeAllApproved = false;
      }

      if (!isWeeklyTaskApproved(afterTask)) {
        afterAllApproved = false;
      }

      if (!beforeAllApproved && !afterAllApproved) {
        break;
      }
    }

    if (beforeAllApproved || !afterAllApproved) {
      return;
    }

    const totalWeeklyTasks = weeklyTasksSnap.size;
    console.log(`Weekly allowance unlocked for family ${familyId}`);

    await sendPushToChildren(
      familyId,
      "Ukelonn opptjent 🎉",
      `Alle ${totalWeeklyTasks} ukesoppgaver er godkjent. Bra jobbet!`,
      { link: `${APP_BASE_PATH}/child/#weekly-tasks` }
    );
  }
);

// ─── Firestore trigger: Notify child when a new bonus task is created ─────
export const onBonusTaskCreated = onDocumentCreated(
  {
    region: FUNCTION_REGION,
    document: "families/{familyId}/tasks/{taskId}",
  },
  async (event) => {
    const { familyId, taskId } = event.params;
    const task = event.data?.data() as TaskDocument | undefined;

    if (!task || task.type !== "bonus") {
      return;
    }

    if (task.source === "seed" || task.seeded === true) {
      console.log(`Skipping seeded bonus notification for ${taskId}`);
      return;
    }

    const title = "Ny bonusoppgave 🎉";
    const body = task.valueNok !== undefined
      ? `${task.title ?? "Ny bonusoppgave"} (+kr ${task.valueNok})`
      : task.title ?? "Ny bonusoppgave";

    await sendPushToChildren(familyId, title, body);
  }
);

// ─── Scheduled trigger: Weekly reminder on Sunday morning ──────────────────
export const weeklyReminderSunday = onSchedule(
  {
    region: FUNCTION_REGION,
    schedule: "0 8 * * 0", // Every Sunday at 08:00 UTC
    timeZone: OSLO_TIME_ZONE, // Adjust to your timezone
  },
  async () => {
    console.log("Weekly reminder triggered at", new Date().toISOString());

    await sendPushToParents(
      FAMILY_ID,
      "Ny uke – gå gjennom oppgaver og nullstill",
      "Planlegg uka med barnet ditt.",
      { link: `${APP_BASE_PATH}/parent/` }
    );
  }
);

// ─── Scheduled trigger: Weekday reminder for child tasks ───────────────────
export const childDailyWeekdayReminder = onSchedule(
  {
    region: FUNCTION_REGION,
    schedule: "0 16 * * 1-5", // Every weekday at 16:00
    timeZone: OSLO_TIME_ZONE,
  },
  async () => {
    const taskDay = mapOsloWeekdayToTaskDay();
    if (!taskDay) {
      return;
    }

    console.log(`Child weekday reminder triggered for ${taskDay}`);

    const familiesSnap = await db.collection("families").get();
    for (const familyDoc of familiesSnap.docs) {
      const familyId = familyDoc.id;
      const tasksSnap = await db
        .collection("families")
        .doc(familyId)
        .collection("tasks")
        .where("type", "==", "weekly")
        .where("day", "==", taskDay)
        .get();

      if (tasksSnap.empty) {
        continue;
      }

      const hasRemainingTasks = tasksSnap.docs.some((taskDoc) => {
        const task = taskDoc.data() as TaskDocument;
        return task.checkedByChild !== true || task.approvalStatus !== "approved";
      });

      if (!hasRemainingTasks) {
        continue;
      }

      await sendPushToChildren(
        familyId,
        "Husk dagens oppgaver ✅",
        "Åpne appen og kryss av når du er ferdig.",
        { link: `${APP_BASE_PATH}/child/#weekly-tasks` }
      );
    }
  }
);

// ─── Scheduled trigger: Parent evening summary for pending approvals ───────
export const parentEveningPendingSummary = onSchedule(
  {
    region: FUNCTION_REGION,
    schedule: "0 19 * * 1-5", // Weekdays at 19:00
    timeZone: OSLO_TIME_ZONE,
  },
  async () => {
    console.log("Parent evening pending summary triggered at", new Date().toISOString());

    const familiesSnap = await db.collection("families").get();
    for (const familyDoc of familiesSnap.docs) {
      const familyId = familyDoc.id;
      const pendingSnap = await db
        .collection("families")
        .doc(familyId)
        .collection("tasks")
        .where("approvalStatus", "==", "pending")
        .get();

      if (pendingSnap.empty) {
        continue;
      }

      const pendingCount = pendingSnap.size;
      const taskPreview = pendingSnap.docs
        .map((docSnap) => {
          const task = docSnap.data() as TaskDocument;
          return task.title?.trim();
        })
        .filter((title): title is string => Boolean(title))
        .slice(0, 2)
        .join(", ");

      const body = taskPreview
        ? `${pendingCount} oppgaver venter: ${taskPreview}${pendingCount > 2 ? " ..." : ""}`
        : `${pendingCount} oppgaver venter pa godkjenning.`;

      await sendPushToParents(
        familyId,
        "Kveldssammendrag: godkjenning",
        body,
        { link: `${APP_BASE_PATH}/parent/#pending-approval` }
      );
    }
  }
);
