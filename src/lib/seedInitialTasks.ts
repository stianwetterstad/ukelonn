import { collection, getDocs, addDoc } from "firebase/firestore";
import { db } from "./firebase";
import { INITIAL_TASKS } from "./tasks";

const familyId = "family-default";

export async function seedInitialTasks() {
  const tasksRef = collection(db, `families/${familyId}/tasks`);
  const standardTasksRef = collection(db, `families/${familyId}/standardTasks`);

  const tasksSnapshot = await getDocs(tasksRef);

  // ✅ Hvis ukens oppgaver allerede finnes: gjør ingenting
  if (!tasksSnapshot.empty) {
    console.log("✅ Tasks already seeded");
    return;
  }

  const standardTasksSnapshot = await getDocs(standardTasksRef);

  if (!standardTasksSnapshot.empty) {
    // 📋 Kopier standardTasks til tasks med standardTaskId-kobling
    console.log("🌱 Seeding tasks from standardTasks...");
    for (const standardDoc of standardTasksSnapshot.docs) {
      const data = standardDoc.data();
      await addDoc(tasksRef, {
        title: data.title,
        type: data.type,
        ...(data.type === "bonus" && { source: "seed" }),
        ...(data.day !== undefined && { day: data.day }),
        ...(data.subtitle !== undefined && { subtitle: data.subtitle }),
        ...(data.valueNok !== undefined && { valueNok: data.valueNok }),
        checkedByChild: false,
        approvalStatus: "none",
        standardTaskId: standardDoc.id,
      });
    }
    console.log("✅ Tasks seeded from standardTasks");
  } else {
    // 🌱 Første gang: seed fra INITIAL_TASKS og lagre også i standardTasks
    console.log("🌱 Seeding initial tasks and standardTasks...");
    for (const task of INITIAL_TASKS) {
      const standardDoc = await addDoc(standardTasksRef, {
        title: task.title,
        type: task.type,
        ...(task.day !== undefined && { day: task.day }),
        ...(task.subtitle !== undefined && { subtitle: task.subtitle }),
        ...(task.valueNok !== undefined && { valueNok: task.valueNok }),
      });
      await addDoc(tasksRef, {
        ...task,
        ...(task.type === "bonus" && { source: "seed" }),
        standardTaskId: standardDoc.id,
      });
    }
    console.log("✅ Initial tasks and standardTasks seeded");
  }
}
