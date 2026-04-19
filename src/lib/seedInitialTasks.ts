import { collection, getDocs, addDoc } from "firebase/firestore";
import { db } from "./firebase";
import { INITIAL_TASKS } from "./tasks";

const familyId = "family-default";

export async function seedInitialTasks() {
  const tasksRef = collection(db, `families/${familyId}/tasks`);
  const snapshot = await getDocs(tasksRef);

  // ✅ Hvis det allerede finnes oppgaver: gjør ingenting
  if (!snapshot.empty) {
    console.log("✅ Tasks already seeded");
    return;
  }

  console.log("🌱 Seeding initial tasks...");

  for (const task of INITIAL_TASKS) {
    await addDoc(tasksRef, { ...task });
  }

  console.log("✅ Initial tasks seeded");
}