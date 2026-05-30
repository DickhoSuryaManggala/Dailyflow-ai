import { Task, ActivityLog, UserSettings, DailySummary, MonthlyEvaluation } from "../types";
import { db, isFirebaseConfigured, handleFirestoreError, OperationType } from "../firebase";
import { encryptText, decryptText } from "./crypto";

// Default settings if nothing exists
export const DEFAULT_SETTINGS: UserSettings = {
  userId: "local-user",
  futureGoals: "Menjadi ahli teknologi yang disiplin dan produktif secara seimbang.",
  freeTimeRanges: ["12:00-13:00", "18:30-20:00"],
  e2eEnabled: false,
  emailReportEnabled: false,
  emailRecipient: "",
  theme: "dark",
  autoAIPlannerEnabled: false,
};

// Key names for localStorage
const KEYS = {
  TASKS: "dailyflow_tasks",
  LOGS: "dailyflow_logs",
  SETTINGS: "dailyflow_settings",
  SUMMARIES: "dailyflow_summaries",
  EVALUATIONS: "dailyflow_evaluations",
};

// Safe localStorage helper
const safeGetItem = (key: string, fallback: string): string => {
  try {
    return localStorage.getItem(key) || fallback;
  } catch (e) {
    return fallback;
  }
};

const safeSetItem = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.error("Local storage error:", e);
  }
};

// ======================== LOCAL STORAGE PRIMITIVES ========================

export function getLocalTasks(): Task[] {
  return JSON.parse(safeGetItem(KEYS.TASKS, "[]"));
}

export function saveLocalTasks(tasks: Task[]) {
  safeSetItem(KEYS.TASKS, JSON.stringify(tasks));
}

export function getLocalLogs(): ActivityLog[] {
  return JSON.parse(safeGetItem(KEYS.LOGS, "[]"));
}

export function saveLocalLogs(logs: ActivityLog[]) {
  safeSetItem(KEYS.LOGS, JSON.stringify(logs));
}

export function getLocalSettings(userId: string = "local-user"): UserSettings {
  const allSettings = JSON.parse(safeGetItem(KEYS.SETTINGS, "{}"));
  return allSettings[userId] || { ...DEFAULT_SETTINGS, userId };
}

export function saveLocalSettings(userId: string, settings: UserSettings) {
  const allSettings = JSON.parse(safeGetItem(KEYS.SETTINGS, "{}"));
  allSettings[userId] = settings;
  safeSetItem(KEYS.SETTINGS, JSON.stringify(allSettings));
}

export function getLocalSummaries(): DailySummary[] {
  return JSON.parse(safeGetItem(KEYS.SUMMARIES, "[]"));
}

export function saveLocalSummaries(summaries: DailySummary[]) {
  safeSetItem(KEYS.SUMMARIES, JSON.stringify(summaries));
}

export function getLocalEvaluations(): MonthlyEvaluation[] {
  return JSON.parse(safeGetItem(KEYS.EVALUATIONS, "[]"));
}

export function saveLocalEvaluations(evaluations: MonthlyEvaluation[]) {
  safeSetItem(KEYS.EVALUATIONS, JSON.stringify(evaluations));
}

// ======================== FIRESTORE SYNC & WRAPPER API ========================

/**
 * Sync entire local data to cloud collection (e.g. on login or reconnect)
 */
export async function syncLocalDataToCloud(userId: string) {
  if (!isFirebaseConfigured() || userId === "local-user") return;
  const { doc, setDoc } = await import("firebase/firestore");
  
  try {
    // 1. Sync tasks
    const localTasks = getLocalTasks().filter(t => t.userId === userId || t.userId === "local-user");
    for (const t of localTasks) {
      const cloudTask = { ...t, userId }; // map to correct UID
      await setDoc(doc(db, "tasks", t.id), cloudTask);
    }

    // 2. Sync logs
    const localLogs = getLocalLogs().filter(l => l.userId === userId || l.userId === "local-user");
    for (const l of localLogs) {
      const cloudLog = { ...l, userId };
      await setDoc(doc(db, "activityLogs", l.id), cloudLog);
    }

    // 3. Sync settings
    const localSettings = getLocalSettings("local-user");
    await setDoc(doc(db, "userSettings", userId), { ...localSettings, userId });

    // 4. Sync summaries
    const localSummaries = getLocalSummaries().filter(s => s.userId === userId || s.userId === "local-user");
    for (const s of localSummaries) {
      const cloudSummary = { ...s, userId };
      await setDoc(doc(db, "dailySummaries", s.id), cloudSummary);
    }
    
    console.log("[FIREBASE] Sync with cloud complete for UUID:", userId);
  } catch (error) {
    console.error("[FIREBASE] Synchronization failed during syncLocalDataToCloud:", error);
  }
}

/**
 * TASKS STORAGE
 */
export async function saveTask(task: Task, e2ePassword?: string): Promise<void> {
  const encryptedTask: Task = {
    ...task,
    title: task.routine === "work" || task.routine === "habit" || task.routine === "leisure"
      ? encryptText(task.title, e2ePassword)
      : task.title,
    notes: encryptText(task.notes, e2ePassword),
  };

  // 1. Save to local storage
  const localTasks = getLocalTasks();
  const index = localTasks.findIndex(t => t.id === task.id);
  if (index !== -1) {
    localTasks[index] = encryptedTask;
  } else {
    localTasks.push(encryptedTask);
  }
  saveLocalTasks(localTasks);

  // 2. Synchronize to Firestore
  if (isFirebaseConfigured() && task.userId !== "local-user") {
    const { doc, setDoc } = await import("firebase/firestore");
    const path = `tasks/${task.id}`;
    try {
      await setDoc(doc(db, "tasks", task.id), encryptedTask);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
}

export async function deleteTask(taskId: string, userId: string): Promise<void> {
  // 1. Local delete
  const localTasks = getLocalTasks();
  saveLocalTasks(localTasks.filter(t => t.id !== taskId));

  // 2. Cloud delete
  if (isFirebaseConfigured() && userId !== "local-user") {
    const { doc, deleteDoc } = await import("firebase/firestore");
    const path = `tasks/${taskId}`;
    try {
      await deleteDoc(doc(db, "tasks", taskId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }
}

export function queryTasks(userId: string, dateStr: string, e2ePassword?: string): Task[] {
  const localTasks = getLocalTasks();
  const tasksForUserOnDate = localTasks.filter(
    t => (t.userId === userId || t.userId === "local-user") && t.date === dateStr
  );

  // Decrypt tasks on retrieval
  return tasksForUserOnDate.map(t => ({
    ...t,
    title: decryptText(t.title, e2ePassword),
    notes: decryptText(t.notes, e2ePassword),
  }));
}

/**
 * ACTIVITY TRACKER MONITOR STORAGE
 */
export async function saveActivityLog(log: ActivityLog): Promise<void> {
  // 1. Local save
  const localLogs = getLocalLogs();
  const index = localLogs.findIndex(l => l.id === log.id);
  if (index !== -1) {
    localLogs[index] = log;
  } else {
    localLogs.push(log);
  }
  saveLocalLogs(localLogs);

  // 2. Cloud save
  if (isFirebaseConfigured() && log.userId !== "local-user") {
    const { doc, setDoc } = await import("firebase/firestore");
    const path = `activityLogs/${log.id}`;
    try {
      await setDoc(doc(db, "activityLogs", log.id), log);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
}

export async function deleteActivityLog(logId: string, userId: string): Promise<void> {
  // 1. Local delete
  const localLogs = getLocalLogs();
  saveLocalLogs(localLogs.filter(l => l.id !== logId));

  // 2. Cloud delete
  if (isFirebaseConfigured() && userId !== "local-user") {
    const { doc, deleteDoc } = await import("firebase/firestore");
    const path = `activityLogs/${logId}`;
    try {
      await deleteDoc(doc(db, "activityLogs", logId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }
}

export function queryActivityLogs(userId: string, dateStr: string): ActivityLog[] {
  const localLogs = getLocalLogs();
  return localLogs.filter(
    l => (l.userId === userId || l.userId === "local-user") && l.date === dateStr
  );
}

/**
 * USER SETTINGS STORAGE
 */
export async function saveUserSettings(userId: string, settings: UserSettings): Promise<void> {
  // 1. Local save
  saveLocalSettings(userId, settings);
  if (userId !== "local-user") {
    saveLocalSettings("local-user", settings); // keep synchronized
  }

  // 2. Cloud save
  if (isFirebaseConfigured() && userId !== "local-user") {
    const { doc, setDoc } = await import("firebase/firestore");
    const path = `userSettings/${userId}`;
    try {
      await setDoc(doc(db, "userSettings", userId), settings);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
}

/**
 * DAILY SUMMARIES STORAGE
 */
export async function saveDailySummary(summary: DailySummary): Promise<void> {
  // 1. Local save
  const localSummaries = getLocalSummaries();
  const index = localSummaries.findIndex(s => s.id === summary.id && s.userId === summary.userId);
  if (index !== -1) {
    localSummaries[index] = summary;
  } else {
    localSummaries.push(summary);
  }
  saveLocalSummaries(localSummaries);

  // 2. Cloud save
  if (isFirebaseConfigured() && summary.userId !== "local-user") {
    const { doc, setDoc } = await import("firebase/firestore");
    const path = `dailySummaries/${summary.id}`;
    try {
      await setDoc(doc(db, "dailySummaries", summary.id), summary);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
}

export function queryDailySummary(userId: string, dateStr: string): DailySummary | null {
  const localSummaries = getLocalSummaries();
  return localSummaries.find(
    s => (s.userId === userId || s.userId === "local-user") && s.date === dateStr
  ) || null;
}

/**
 * MONTHLY EVALUATIONS STORAGE
 */
export async function saveMonthlyEvaluation(evaluation: MonthlyEvaluation): Promise<void> {
  // 1. Local save
  const localEvals = getLocalEvaluations();
  const index = localEvals.findIndex(e => e.id === evaluation.id && e.userId === evaluation.userId);
  if (index !== -1) {
    localEvals[index] = evaluation;
  } else {
    localEvals.push(evaluation);
  }
  saveLocalEvaluations(localEvals);

  // 2. Cloud save
  if (isFirebaseConfigured() && evaluation.userId !== "local-user") {
    const { doc, setDoc } = await import("firebase/firestore");
    const path = `monthlyEvaluations/${evaluation.id}`;
    try {
      await setDoc(doc(db, "monthlyEvaluations", evaluation.id), evaluation);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
}

export function queryMonthlyEvaluation(userId: string, monthId: string): MonthlyEvaluation | null {
  const localEvals = getLocalEvaluations();
  return localEvals.find(
    e => (e.userId === userId || e.userId === "local-user") && e.id === monthId
  ) || null;
}
