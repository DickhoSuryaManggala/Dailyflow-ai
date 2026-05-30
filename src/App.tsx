import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Calendar,
  Activity,
  BarChart3,
  BrainCircuit,
  Settings,
  Plus,
  Trash2,
  Check,
  Download,
  Lock,
  Unlock,
  Sun,
  Moon,
  LogIn,
  LogOut,
  Bell,
  CheckCircle,
  FileText,
  RefreshCw,
  Sparkles,
  Info,
  X
} from "lucide-react";

// Local module imports
import { Task, ActivityLog, UserSettings, DailySummary, MonthlyEvaluation } from "./types";
import { isFirebaseConfigured, auth, googleProvider, db } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import {
  queryTasks,
  saveTask,
  deleteTask,
  queryActivityLogs,
  saveActivityLog,
  deleteActivityLog,
  getLocalTasks,
  saveLocalTasks,
  getLocalLogs,
  getLocalSettings,
  saveUserSettings,
  getLocalSummaries,
  saveDailySummary,
  getLocalEvaluations,
  saveMonthlyEvaluation,
  syncLocalDataToCloud
} from "./utils/storage";
import {
  getNotifications,
  addOnNotificationChange,
  removeOnNotificationChange,
  requestBrowserNotificationPermission,
  spawnNotification,
  tickNotificationScheduler,
  clearNotifications,
  markAsRead,
  ActiveNotification
} from "./utils/notifications";
import { exportDataToCSV, exportTasksToICS } from "./utils/exporters";

// Helper to get Indonesian day name for a given date string (YYYY-MM-DD or standard)
export function getIndonesianDayName(dateStr: string) {
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-indexed month
    const day = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) {
      return days[d.getDay()];
    }
  }
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return days[d.getDay()];
  }
  return "";
}

// Helper to format date in Indonesian format: DD Month YYYY
export function formatIndonesianDate(dateStr: string) {
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const day = parseInt(parts[2], 10);
    const monthIndex = parseInt(parts[1], 10) - 1;
    const year = parts[0];
    if (monthIndex >= 0 && monthIndex < 12) {
      return `${day} ${months[monthIndex]} ${year}`;
    }
  }
  return dateStr;
}

// Helper to get styled task category tag dynamically (supports both work and academic tasks)
export function getTaskTagInfo(task: Task) {
  const titleLower = task.title.toLowerCase();
  const notesLower = (task.notes || "").toLowerCase();
  const hasAcademicKeyword = 
    titleLower.includes("kuliah") || 
    titleLower.includes("ngampus") || 
    titleLower.includes("kampus") || 
    titleLower.includes("kelas") || 
    titleLower.includes("matkul") || 
    titleLower.includes("belajar") || 
    titleLower.includes("dosen") || 
    titleLower.includes("mahasiswa") || 
    titleLower.includes("akademik") ||
    notesLower.includes("kuliah") || 
    notesLower.includes("ngampus") || 
    notesLower.includes("kampus") || 
    notesLower.includes("kelas") || 
    notesLower.includes("matkul") || 
    notesLower.includes("belajar") || 
    notesLower.includes("dosen") || 
    notesLower.includes("mahasiswa") || 
    notesLower.includes("akademik");

  if (task.routine === "work") {
    if (hasAcademicKeyword) {
      return {
        label: "Kuliah / Belajar",
        badgeClass: "bg-blue-950/20 border-blue-900/40 text-blue-400"
      };
    }
    return {
      label: "Pekerjaan",
      badgeClass: "bg-purple-950/20 border-purple-900/40 text-purple-400"
    };
  } else if (task.routine === "habit") {
    return {
      label: "Kebiasaan",
      badgeClass: "bg-emerald-950/20 border-emerald-900/40 text-emerald-400"
    };
  } else {
    return {
      label: "Waktu Luang",
      badgeClass: "bg-amber-950/20 border-amber-900/40 text-amber-400"
    };
  }
}


// Tab Sub-Components
import AIPersonalizer from "./components/AIPersonalizer";
import PerformanceReview from "./components/PerformanceReview";
import WeeklyDashboard from "./components/WeeklyDashboard";

export default function App() {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<"planner" | "schedule" | "dashboard" | "evaluation" | "settings">("schedule");

  // Authentication & Sync stats
  const [user, setUser] = useState<any>(null);
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [loading, setLoading] = useState(true);

  // Core Data State
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [collegeDays, setCollegeDays] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("student-college-days");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [settings, setSettings] = useState<UserSettings>(() => getLocalSettings("local-user"));
  const [dailySummaries, setDailySummaries] = useState<DailySummary[]>([]);
  const [monthlyEvaluations, setMonthlyEvaluations] = useState<MonthlyEvaluation[]>([]);

  // Password-based E2E state
  const [e2eInputPassword, setE2eInputPassword] = useState("");
  const [isE2eUnlocked, setIsE2eUnlocked] = useState(false);

  // Clear & Reset Confirmation states
  const [showClearTodayConfirm, setShowClearTodayConfirm] = useState(false);
  const [showResetAllConfirm, setShowResetAllConfirm] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);

  // In-app Notifications state
  const [notifications, setNotifications] = useState<ActiveNotification[]>([]);
  const [showNotificationsMenu, setShowNotificationsMenu] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotificationsMenu(false);
      }
    }
    if (showNotificationsMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showNotificationsMenu]);

  // Tauri / WebView popup block handler states
  const [showTauriHelpModal, setShowTauriHelpModal] = useState(false);
  const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({});

  // Custom motivation quote state
  const [motivationQuote, setMotivationQuote] = useState("");

  // AI Roster Pedas Popup State
  const [showRoastPopup, setShowRoastPopup] = useState(false);
  const [roastPopupContent, setRoastPopupContent] = useState("");
  const [loadingRoastPopup, setLoadingRoastPopup] = useState(false);

  const fetchInitialRoast = async () => {
    setLoadingRoastPopup(true);
    try {
      const currentUID = user ? user.uid : "local-user";
      const activePassword = settings.e2eEnabled && isE2eUnlocked ? e2eInputPassword : undefined;
      const fetchedTasks = queryTasks(currentUID, selectedDate, activePassword);
      const fetchedLogs = queryActivityLogs(currentUID, selectedDate);
      
      const completedTasks = fetchedTasks.filter(t => t.completed).length;
      const totalTasks = fetchedTasks.length;
      
      const stats = fetchedLogs.reduce((acc, curr) => {
        if (curr.type === "focus") acc.focus += curr.durationMinutes;
        else if (curr.type === "distraction") acc.distraction += curr.durationMinutes;
        return acc;
      }, { focus: 0, distraction: 0 });

      const response = await fetch("/api/gemini/roast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          futureGoals: settings.futureGoals || "Sukses mulia",
          completedTasks,
          totalTasks,
          focusMinutes: stats.focus,
          distractionMinutes: stats.distraction
        }),
      });

      const data = await response.json();
      if (data.success && data.roast) {
        setRoastPopupContent(data.roast);
      } else {
        throw new Error("No roast generated");
      }
    } catch (err: any) {
      const fallbackRoasts = [
        `Target Masa Depan: "${settings.futureGoals || "Mendapatkan kesuksesan"}". Tapi aksi hari ini belum ada. Ingat, mimpi tinggi tanpa usaha nyata sama saja seperti menunggu durian runtuh tanpa pohonnya!`,
        `Katanya ingin "${settings.futureGoals || "Sukses mulia"}", tapi kerjaannya rebahan terus. Mau sukses jalur langit? Jalur langit juga butuh doa dan usaha, bukan scroll sosmed!`,
        `Sasaran besar Anda: "${settings.futureGoals || "Sukses mulia"}". Catatan hari ini masih sangat mini. Jangan biarkan besok juga hanya jadi wacana kosong bertajuk "mulai senin depan"!`
      ];
      const randomFallback = fallbackRoasts[Math.floor(Math.random() * fallbackRoasts.length)];
      setRoastPopupContent(randomFallback);
    } finally {
      setLoadingRoastPopup(false);
    }
  };

  useEffect(() => {
    // Show AI Roast Popup every time the website is opened
    setShowRoastPopup(true);
    fetchInitialRoast();
  }, []);

  useEffect(() => {
    if (showRoastPopup) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showRoastPopup]);

  // Task creation inputs
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskNotes, setNewTaskNotes] = useState("");
  const [newTaskStart, setNewTaskStart] = useState("08:00");
  const [newTaskEnd, setNewTaskEnd] = useState("09:00");
  const [newTaskRoutine, setNewTaskRoutine] = useState<"work" | "leisure" | "habit">("work");

  // Track Firebase connection state
  useEffect(() => {
    setFirebaseReady(isFirebaseConfigured());
    
    let unsubscribe = () => {};
    if (isFirebaseConfigured()) {
      unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        if (currentUser) {
          setUser(currentUser);
          // Sync local variables to the secure Firestore database
          await syncLocalDataToCloud(currentUser.uid);
          // Re-load settings for this particular user
          const loadedSettings = getLocalSettings(currentUser.uid);
          setSettings(loadedSettings);
        } else {
          setUser(null);
          setSettings(getLocalSettings("local-user"));
        }
        setLoading(false);
      });
    } else {
      setLoading(false);
    }

    return () => unsubscribe();
  }, [firebaseReady]);

  // Handle browser tab theme on load
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
    }
  }, [settings.theme]);

  // Load / Reload core data variables when date, user, or E2E unlock state changes
  useEffect(() => {
    const currentUID = user ? user.uid : "local-user";
    const activePassword = settings.e2eEnabled && isE2eUnlocked ? e2eInputPassword : undefined;
    
    // Fetch cached tasks and logs
    const fetchedTasks = queryTasks(currentUID, selectedDate, activePassword);
    const fetchedLogs = queryActivityLogs(currentUID, selectedDate);
    
    setTasks(fetchedTasks);
    setActivityLogs(fetchedLogs);
    setDailySummaries(getLocalSummaries());
    setMonthlyEvaluations(getLocalEvaluations());
  }, [selectedDate, user, isE2eUnlocked, settings.e2eEnabled, e2eInputPassword]);

  // Notifications observer binding
  useEffect(() => {
    setNotifications(getNotifications());
    
    const handleNotificationUpdate = () => {
      setNotifications(getNotifications());
    };
    addOnNotificationChange(handleNotificationUpdate);
    return () => removeOnNotificationChange(handleNotificationUpdate);
  }, []);

  // Periodic Alarm scheduler ticks (every 10 seconds check schedule times)
  useEffect(() => {
    const interval = setInterval(() => {
      tickNotificationScheduler(tasks, settings.freeTimeRanges);
    }, 10000);
    return () => clearInterval(interval);
  }, [tasks, settings.freeTimeRanges]);

  // Auto-fill personalized targets quote initially
  useEffect(() => {
    if (settings.futureGoals && !motivationQuote) {
      setMotivationQuote(`🏆 Fokus hari ini adalah melangkah mendekati impian Anda: "${settings.futureGoals}". Selesaikan tugas terjadwal agar terus konsisten!`);
    }
  }, [settings.futureGoals]);

  // Automated 00:00 or Daily first-load AI Planner Generator
  useEffect(() => {
    const todayDateStr = new Date().toISOString().split("T")[0];
    if (settings.autoAIPlannerEnabled && selectedDate === todayDateStr && tasks.length === 0 && !isAutoGenerating) {
      triggerAutoAIScheduleGeneration(selectedDate);
    }
  }, [selectedDate, tasks.length, settings.autoAIPlannerEnabled, isAutoGenerating]);

  // Monitor midnight / day rollover to automatically select the new day and trigger generation
  useEffect(() => {
    const interval = setInterval(() => {
      const todayStr = new Date().toISOString().split("T")[0];
      if (selectedDate !== todayStr && settings.autoAIPlannerEnabled) {
        // Day rolled over! Update selectedDate to the new day automatically
        setSelectedDate(todayStr);
        spawnNotification("🔄 Pergantian Hari (00:00)", "Hari telah berganti. DailyFlow otomatis beralih ke jadwal hari baru!", "info");
      }
    }, 15000); // Check rollover every 15 seconds
    return () => clearInterval(interval);
  }, [selectedDate, settings.autoAIPlannerEnabled]);

  // ======================== DB & WRAPPER EVENTS ========================

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const currentUID = user ? user.uid : "local-user";
    const password = settings.e2eEnabled && isE2eUnlocked ? e2eInputPassword : undefined;

    const task: Task = {
      id: Math.random().toString(36).substr(2, 9),
      userId: currentUID,
      title: newTaskTitle.trim(),
      notes: newTaskNotes.trim(),
      startTime: newTaskStart,
      endTime: newTaskEnd,
      routine: newTaskRoutine,
      completed: false,
      date: selectedDate,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await saveTask(task, password);
    
    // Clear inputs
    setNewTaskTitle("");
    setNewTaskNotes("");
    
    // Trigger updated load
    setTasks(queryTasks(currentUID, selectedDate, password));
    spawnNotification("✅ Tugas Ditambahkan", `Tugas "${task.title}" berhasil dijadwalkan pada jam ${task.startTime}.`, "info");
  };

  const handleToggleTask = async (task: Task) => {
    const currentUID = user ? user.uid : "local-user";
    const password = settings.e2eEnabled && isE2eUnlocked ? e2eInputPassword : undefined;

    const updatedTask = {
      ...task,
      completed: !task.completed,
      updatedAt: Date.now()
    };

    await saveTask(updatedTask, password);
    setTasks(queryTasks(currentUID, selectedDate, password));

    if (updatedTask.completed) {
      spawnNotification("✨ Tugas Selesai!", `Selamat! Anda menyelesaikan kegiatan "${task.title}". Pertahankan progres ini!`, "achievement");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    const currentUID = user ? user.uid : "local-user";
    const password = settings.e2eEnabled && isE2eUnlocked ? e2eInputPassword : undefined;

    await deleteTask(taskId, currentUID);
    setTasks(queryTasks(currentUID, selectedDate, password));
  };

  const handleClearAllTasksToday = async () => {
    const currentUID = user ? user.uid : "local-user";
    const password = settings.e2eEnabled && isE2eUnlocked ? e2eInputPassword : undefined;

    const allLocalTasks = getLocalTasks();
    const tasksToKeep = allLocalTasks.filter(
      t => !((t.userId === currentUID || t.userId === "local-user") && t.date === selectedDate)
    );
    saveLocalTasks(tasksToKeep);

    if (isFirebaseConfigured() && currentUID !== "local-user") {
      try {
        const { doc, deleteDoc } = await import("firebase/firestore");
        const tasksForToday = allLocalTasks.filter(
          t => (t.userId === currentUID || t.userId === "local-user") && t.date === selectedDate
        );
        for (const t of tasksForToday) {
          await deleteDoc(doc(db, "tasks", t.id));
        }
      } catch (error) {
        console.error("Firebase clear tasks error:", error);
      }
    }

    setTasks([]);
    setShowClearTodayConfirm(false);
    spawnNotification("🗑️ Agenda Dibersihkan", `Semua agenda hari ini (${selectedDate}) berhasil dihapus.`, "info");
  };

  const handleResetAllTasks = async () => {
    const currentUID = user ? user.uid : "local-user";
    const password = settings.e2eEnabled && isE2eUnlocked ? e2eInputPassword : undefined;

    const allLocalTasks = getLocalTasks();
    const tasksToKeep = allLocalTasks.filter(
      t => !(t.userId === currentUID || t.userId === "local-user")
    );
    saveLocalTasks(tasksToKeep);

    if (isFirebaseConfigured() && currentUID !== "local-user") {
      try {
        const { doc, deleteDoc } = await import("firebase/firestore");
        const tasksToReset = allLocalTasks.filter(
          t => (t.userId === currentUID || t.userId === "local-user")
        );
        for (const t of tasksToReset) {
          await deleteDoc(doc(db, "tasks", t.id));
        }
      } catch (error) {
        console.error("Firebase reset tasks error:", error);
      }
    }

    // Reset college days settings and schedules
    setCollegeDays([]);
    localStorage.removeItem("student-college-days");
    localStorage.removeItem("student-day-schedules");
    localStorage.removeItem("ai_profile_profession");
    localStorage.removeItem("ai_profile_schoolSchedule");
    localStorage.removeItem("ai_profile_jobType");
    localStorage.removeItem("ai_profile_adHocHandling");
    localStorage.removeItem("ai_profile_wakeTime");
    localStorage.removeItem("ai_profile_sleepTime");
    localStorage.removeItem("ai_profile_activityPref");
    localStorage.removeItem("ai_profile_step");
    localStorage.removeItem("ai_profile_messages");
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("ai_auto_attempt_")) {
        localStorage.removeItem(key);
      }
    });
    setResetKey(prev => prev + 1);

    setTasks([]);
    setShowResetAllConfirm(false);
    spawnNotification("💥 Data Berhasil Direset", "Seluruh data agenda dari semua hari telah berhasil dikosongkan.", "info");
  };

  // AI Planner Integration callback (updates target schedule in 1-click)
  const handleAIScheduleGenerated = async (aiTasks: any[]) => {
    const currentUID = user ? user.uid : "local-user";
    const password = settings.e2eEnabled && isE2eUnlocked ? e2eInputPassword : undefined;

    for (const item of aiTasks) {
      const task: Task = {
        id: Math.random().toString(36).substr(2, 9),
        userId: currentUID,
        title: item.title,
        notes: item.notes,
        startTime: item.startTime,
        endTime: item.endTime,
        routine: item.routine,
        completed: false,
        date: selectedDate,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await saveTask(task, password);
    }

    setTasks(queryTasks(currentUID, selectedDate, password));
    setActiveTab("schedule");
    spawnNotification("🤖 AI Planner Sukses", `${aiTasks.length} jadwal rekomendasi AI berhasil ditambahkan untuk hari ini!`, "achievement");
  };

  const triggerAutoAIScheduleGeneration = async (targetDate: string) => {
    if (isAutoGenerating) return;
    
    const currentUID = user ? user.uid : "local-user";
    const password = settings.e2eEnabled && isE2eUnlocked ? e2eInputPassword : undefined;
    
    // Check if we already attempted/generated for this date to prevent infinite loop
    const attemptKey = `ai_auto_attempt_${currentUID}_${targetDate}`;
    if (localStorage.getItem(attemptKey) === "true") {
      return;
    }
    
    // Also, don't generate if selectedDate has existing tasks!
    const existingTasksForDate = queryTasks(currentUID, targetDate, password);
    if (existingTasksForDate && existingTasksForDate.length > 0) {
      localStorage.setItem(attemptKey, "true"); // mark as done since tasks already exist!
      return;
    }

    setIsAutoGenerating(true);
    localStorage.setItem(attemptKey, "true"); // mark as attempted immediately to prevent double fetches

    try {
      const futureGoals = settings.futureGoals;
      const profession = localStorage.getItem("ai_profile_profession") || "Pelajar / Umum";
      const schoolSchedule = localStorage.getItem("ai_profile_schoolSchedule") || "Tidak disebutkan";
      const jobType = localStorage.getItem("ai_profile_jobType") || "Tidak disebutkan";
      const adHocHandling = localStorage.getItem("ai_profile_adHocHandling") || "Tidak disebutkan";
      const wakeTime = localStorage.getItem("ai_profile_wakeTime") || "06:00";
      const sleepTime = localStorage.getItem("ai_profile_sleepTime") || "22:30";
      const activityPref = localStorage.getItem("ai_profile_activityPref") || "Fokus tingkat tinggi, olahraga sore hari";

      const response = await fetch("/api/gemini/generate-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          futureGoals,
          profession,
          schoolSchedule,
          jobType,
          adHocHandling,
          wakeTime,
          sleepTime,
          activityPref,
          selectedDate: targetDate
        }),
      });

      const data = await response.json();
      if (data.success && data.tasks && data.tasks.length > 0) {
        for (const item of data.tasks) {
          const task: Task = {
            id: Math.random().toString(36).substr(2, 9),
            userId: currentUID,
            title: item.title,
            notes: item.notes,
            startTime: item.startTime,
            endTime: item.endTime,
            routine: item.routine,
            completed: false,
            date: targetDate,
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
          await saveTask(task, password);
        }
        
        // Refresh tasks state if targetDate is selectedDate
        if (targetDate === selectedDate) {
          setTasks(queryTasks(currentUID, selectedDate, password));
        }

        spawnNotification(
          "🤖 AI Auto-Agenda", 
          `Jadwal harian khusus hari ini (${targetDate}) telah dirancang otomatis oleh AI!`, 
          "achievement"
        );
      }
    } catch (err) {
      console.error("Failed to auto-generate AI schedule:", err);
    } finally {
      setIsAutoGenerating(false);
    }
  };

  // Monitor Productivity Log callback
  const handleAddProductivityLog = async (activityName: string, type: "focus" | "rest" | "distraction", duration: number) => {
    const currentUID = user ? user.uid : "local-user";
    
    const log: ActivityLog = {
      id: Math.random().toString(36).substr(2, 9),
      userId: currentUID,
      activityName,
      type,
      durationMinutes: duration,
      timestamp: Date.now(),
      date: selectedDate
    };

    await saveActivityLog(log);
    setActivityLogs(queryActivityLogs(currentUID, selectedDate));
    
    const label = type === "focus" ? "Fokus Kerja" : type === "rest" ? "Istirahat" : "Distraksi";
    spawnNotification("📈 Aktivitas Direkam", `Berhasil merekam ${duration} menit kegiatan "${activityName}" berkategori ${label}.`, "info");
  };

  const handleDeleteProductivityLog = async (logId: string) => {
    const currentUID = user ? user.uid : "local-user";
    await deleteActivityLog(logId, currentUID);
    setActivityLogs(queryActivityLogs(currentUID, selectedDate));
  };

  // Monthly Evaluation callback save
  const handleSaveEvaluation = async (evaluation: MonthlyEvaluation) => {
    await saveMonthlyEvaluation(evaluation);
    setMonthlyEvaluations(getLocalEvaluations());
    spawnNotification("📈 Evaluasi AI Disimpan", `Hasil evaluasi untuk ${evaluation.monthString} tersinkronisasi di cloud.`, "achievement");
  };

  // Settings modification updates
  const handleUpdateGoals = (newGoals: string) => {
    const currentUID = user ? user.uid : "local-user";
    const updated = {
      ...settings,
      futureGoals: newGoals
    };
    setSettings(updated);
    saveUserSettings(currentUID, updated);
  };

  const handleToggleE2E = (enabled: boolean) => {
    const currentUID = user ? user.uid : "local-user";
    const updated = {
      ...settings,
      e2eEnabled: enabled
    };
    setSettings(updated);
    saveUserSettings(currentUID, updated);
    if (!enabled) {
      setIsE2eUnlocked(false);
      setE2eInputPassword("");
    }
  };

  const handleToggleTheme = () => {
    const currentUID = user ? user.uid : "local-user";
    const targetTheme = settings.theme === "dark" ? "light" : "dark";
    const updated: UserSettings = {
      ...settings,
      theme: targetTheme
    };
    setSettings(updated);
    saveUserSettings(currentUID, updated);
    spawnNotification("🎨 Tema Diubah", `Penampilan berhasil disetel ke ${targetTheme === "dark" ? "Mode Gelap" : "Mode Terang"}.`, "info");
  };

  // Helper to detect if running in packaged Tauri desktop app / embedded webview container
  const isTauriEnvironment = () => {
    return (
      typeof window !== "undefined" &&
      (window.location.protocol === "tauri:" ||
       window.location.hostname === "tauri.localhost" ||
       !!(window as any).__TAURI__ ||
       (window.navigator && window.navigator.userAgent && window.navigator.userAgent.toLowerCase().includes("tauri")))
    );
  };

  // Helper to copy links securely inside the app
  const handleCopyLink = (url: string, key: string) => {
    try {
      navigator.clipboard.writeText(url);
      setCopiedStates(prev => ({ ...prev, [key]: true }));
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [key]: false }));
      }, 2000);
      spawnNotification("📋 Link Tersalin", "Alamat web aplikasi berhasil disalin ke clipboard Anda.", "info");
    } catch (e) {
      console.error("Clipboard copy failed:", e);
    }
  };

  // Login via Google provider
  const handleGoogleSignIn = async () => {
    if (!firebaseReady) {
      alert("Firebase tidak siap atau kredensial sedang dikonfigurasi. Anda tetap bisa menggunakan seluruh fitur dalam mode offline!");
      return;
    }

    // Direct detection check for local desktop app packages to prevent unhandled popup errors
    if (isTauriEnvironment()) {
      setShowTauriHelpModal(true);
      return;
    }

    try {
      await signInWithPopup(auth, googleProvider);
      spawnNotification("🔑 Login Berhasil", "Selamat datang kembali! Sinkronisasi cloud real-time aktif.", "achievement");
    } catch (err: any) {
      if (
        err.code === "auth/popup-blocked" || 
        err.message.includes("popup-blocked") ||
        err.message.includes("popup_blocked") ||
        err.code === "auth/popup-closed-by-user"
      ) {
        setShowTauriHelpModal(true);
      } else {
        alert("Gagal login: " + err.message);
      }
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      spawnNotification("🔒 Keluar Akun", "Anda telah keluar. Aplikasi kembali masuk ke mode aman lokal.", "info");
    } catch (err: any) {
      console.error(err);
    }
  };

  // Cumulative metrics derived for tabs
  const completedTasksCount = useMemo(() => tasks.filter(t => t.completed).length, [tasks]);
  const totalTasksCount = useMemo(() => tasks.length, [tasks]);
  
  const statsSummaryMin = useMemo(() => {
    return activityLogs.reduce((acc, curr) => {
      if (curr.type === "focus") acc.focus += curr.durationMinutes;
      else if (curr.type === "rest") acc.rest += curr.durationMinutes;
      else if (curr.type === "distraction") acc.distraction += curr.durationMinutes;
      return acc;
    }, { focus: 0, rest: 0, distraction: 0 });
  }, [activityLogs]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-300 font-sans transition-colors duration-200 p-4 md:p-8 pb-24 lg:pb-8 flex flex-col gap-6">
      
      {/* Premium Floating/Sticky Bottom Navigation Bar for Mobile and Tablets */}
      <div className="lg:hidden fixed bottom-4 left-4 right-4 z-50 bg-zinc-950/85 backdrop-blur-md border border-zinc-901 rounded-2xl p-1.5 sm:p-2 shadow-[0_10px_30px_rgba(0,0,0,0.8)] flex items-center justify-around gap-1">
        <button
          onClick={() => setActiveTab("planner")}
          className={`flex-1 flex flex-col items-center justify-center gap-1 py-1.5 rounded-xl transition-all ${
            activeTab === "planner" 
              ? "text-emerald-400 bg-zinc-900/50 font-bold scale-[1.02]" 
              : "text-zinc-500 hover:text-zinc-300 font-medium"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span className="text-[9px] tracking-tight">AI Planner</span>
        </button>

        <button
          onClick={() => setActiveTab("schedule")}
          className={`flex-1 flex flex-col items-center justify-center gap-1 py-1.5 rounded-xl transition-all ${
            activeTab === "schedule" 
              ? "text-emerald-400 bg-zinc-900/50 font-bold scale-[1.02]" 
              : "text-zinc-500 hover:text-zinc-300 font-medium"
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span className="text-[9px] tracking-tight">Agenda</span>
        </button>
        
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`flex-1 flex flex-col items-center justify-center gap-1 py-1.5 rounded-xl transition-all ${
            activeTab === "dashboard" 
              ? "text-emerald-400 bg-zinc-900/50 font-bold scale-[1.02]" 
              : "text-zinc-500 hover:text-zinc-300 font-medium"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span className="text-[9px] tracking-tight">Statistik</span>
        </button>
        
        <button
          onClick={() => setActiveTab("evaluation")}
          className={`flex-1 flex flex-col items-center justify-center gap-1 py-1.5 rounded-xl transition-all ${
            activeTab === "evaluation" 
              ? "text-emerald-400 bg-zinc-900/50 font-bold scale-[1.02]" 
              : "text-zinc-500 hover:text-zinc-300 font-medium"
          }`}
        >
          <BrainCircuit className="w-4 h-4" />
          <span className="text-[9px] tracking-tight">Evaluasi</span>
        </button>
        
        <button
          onClick={() => setActiveTab("settings")}
          className={`flex-1 flex flex-col items-center justify-center gap-1 py-1.5 rounded-xl transition-all ${
            activeTab === "settings" 
              ? "text-emerald-400 bg-zinc-900/50 font-bold scale-[1.02]" 
              : "text-zinc-500 hover:text-zinc-300 font-medium"
          }`}
        >
          <Settings className="w-4 h-4" />
          <span className="text-[9px] tracking-tight">Setelan</span>
        </button>
      </div>

      {/* Sophisticated Dark Header Panel */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">DAILYFLOW <span className="text-emerald-500">AI</span></h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 md:gap-4 bg-zinc-900/50 border border-zinc-800/80 px-4 py-2 rounded-2xl md:rounded-full shadow-md">
          
          {/* Connection status badge */}
          <button
            onClick={() => setActiveTab("settings")}
            className="flex items-center gap-2 hover:opacity-80 transition-all cursor-pointer text-left"
            title="Klik untuk membuka Pengaturan Mode Online & Cloud Sync"
          >
            <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${user ? "bg-emerald-500 shadow-[0_0_8px_#10B981]" : "bg-amber-400 shadow-[0_0_8px_#F59E0B]"}`} />
            <span className="text-xs font-bold text-zinc-300">
              {user ? "Mode Online Aktif" : "Mode Offline Aman"}
            </span>
          </button>

          <div className="hidden md:block h-4 w-[1px] bg-zinc-800" />

          {/* Alarm in-app bell */}
          <div className="relative" ref={notificationRef}>
            <button
              onClick={() => setShowNotificationsMenu(!showNotificationsMenu)}
              className="p-1.5 bg-zinc-905 hover:bg-zinc-800/90 border border-zinc-800 text-zinc-300 rounded-lg transition-colors cursor-pointer"
              title="Daily Notifications"
            >
              <Bell className="w-3.5 h-3.5 text-zinc-400" />
              {notifications.some(n => !n.read) && (
                <span className="absolute top-0 right-0 w-1.5 h-1.5 rounded-full bg-emerald-500" />
              )}
            </button>

            {/* Notification triggers dropdown dialog */}
            <AnimatePresence>
              {showNotificationsMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="fixed sm:absolute top-20 sm:top-auto left-4 sm:left-auto right-4 sm:right-0 mt-3 sm:w-80 bg-zinc-950/95 backdrop-blur-md border border-zinc-800 rounded-2xl p-4 shadow-[0_10px_40px_rgba(0,0,0,0.9)] z-50"
                >
                  <div className="flex items-center justify-between border-b border-zinc-900 pb-2.5 mb-3">
                    <h3 className="text-xs font-bold text-zinc-100">Daily Reminders & Alerts</h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={clearNotifications}
                        className="text-[9px] font-bold text-zinc-500 hover:text-emerald-400 transition-colors"
                      >
                        Clear All
                      </button>
                      <span className="text-zinc-800 text-[10px]">|</span>
                      <button
                        onClick={() => setShowNotificationsMenu(false)}
                        className="p-1 text-zinc-500 hover:text-rose-450 rounded transition-colors"
                        title="Tutup"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {notifications.length === 0 ? (
                      <div className="text-center py-6 text-[10px] text-zinc-500">
                        No reminders generated yet.
                      </div>
                    ) : (
                      notifications.map(item => (
                        <div
                          key={item.id}
                          onClick={() => markAsRead(item.id)}
                          className={`p-2 rounded-lg text-left select-none text-xs cursor-pointer border transition-colors ${
                            item.read
                              ? "bg-zinc-900/30 border-zinc-900 text-zinc-500"
                              : "bg-emerald-950/10 border-emerald-900/40 text-emerald-300 font-medium"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[11px]">{item.title}</span>
                            <span className="text-[9px] text-zinc-650">
                              {new Date(item.timestamp).toLocaleTimeString("id", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-455 mt-1 leading-relaxed">{item.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* AI Roast Trigger Button */}
          <button
            onClick={() => {
              setShowRoastPopup(true);
              fetchInitialRoast();
            }}
            className="p-1.5 bg-rose-950/15 hover:bg-rose-950/35 border border-rose-900/35 hover:border-rose-900/60 text-rose-400 hover:text-rose-350 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1 shadow-sm"
            title="Buka Sentilan Roster AI 🔥"
          >
            <span className="text-xs">🔥</span>
            <span className="text-[10px] font-black uppercase tracking-wide hidden md:inline-block">Roster AI</span>
          </button>

          <div className="hidden md:block h-4 w-[1px] bg-zinc-800" />

          {/* Theme switcher (re-styled dark look) */}
          <button
            onClick={handleToggleTheme}
            className="p-1.5 bg-zinc-905 hover:bg-zinc-800/90 border border-zinc-800 text-zinc-300 rounded-lg transition-colors cursor-pointer"
            title="Switch Appearance / Accent"
          >
            {settings.theme === "dark" ? <Sun className="w-3.5 h-3.5 text-zinc-400" /> : <Moon className="w-3.5 h-3.5 text-zinc-400" />}
          </button>

          <div className="hidden md:block h-4 w-[1px] bg-zinc-800" />

          {/* User Profile Avatar */}
          <div className="flex items-center gap-2">
            {user ? (
              <img
                src={user.photoURL || "https://ui-avatars.com/api/?name=User&background=222&color=10B981"}
                className="w-7 h-7 rounded-full border border-zinc-800"
                alt="Profile"
              />
            ) : (
              <img
                src="https://ui-avatars.com/api/?name=Guest&background=111&color=71717a"
                className="w-7 h-7 rounded-full border border-zinc-800"
                alt="Profile"
              />
            )}
          </div>

          {/* Login Action toggler */}
          {user ? (
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border border-zinc-800 font-semibold text-xs rounded-xl transition-all"
              title="Log Out Account"
            >
              <LogOut className="w-3 h-3 text-zinc-500" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          ) : (
            <button
              onClick={handleGoogleSignIn}
              disabled={!firebaseReady}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs rounded-xl disabled:opacity-40 cursor-pointer transition-all"
              title="Sync to Firebase"
            >
              <LogIn className="w-3 h-3" />
              <span className="hidden sm:inline">Sync Cloud</span>
            </button>
          )}

        </div>
      </header>

      <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-6 mt-4 flex-1">
        
        {/* Navigation Sidebar Panel */}
        <nav className="hidden lg:flex lg:col-span-3 h-fit bg-zinc-900/20 border border-zinc-800/80 p-5 rounded-2xl flex-col gap-4 lg:gap-2 transition-colors">
          <span className="text-[10.5px] font-bold uppercase tracking-widest text-[#10B981] px-3 block mb-1 font-sans">System Navigation</span>
          
          <div className="flex flex-col gap-2 w-full">
            <button
              onClick={() => setActiveTab("planner")}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left text-xs font-semibold tracking-wide transition-all border ${
                activeTab === "planner"
                  ? "bg-zinc-900 border-l-4 border-l-[#10B981] border-zinc-805 text-white shadow-lg"
                  : "text-zinc-400 border-transparent hover:bg-zinc-900/55 hover:text-zinc-200"
              }`}
            >
              <Sparkles className={`w-4 h-4 ${activeTab === "planner" ? "text-emerald-400" : "text-zinc-500"}`} />
              <span className="truncate">AI Planner &amp; Coach</span>
            </button>

            <button
              onClick={() => setActiveTab("schedule")}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left text-xs font-semibold tracking-wide transition-all border ${
                activeTab === "schedule"
                  ? "bg-zinc-900 border-l-4 border-l-[#10B981] border-zinc-805 text-white shadow-lg"
                  : "text-zinc-400 border-transparent hover:bg-zinc-900/55 hover:text-zinc-200"
              }`}
            >
              <Calendar className={`w-4 h-4 ${activeTab === "schedule" ? "text-emerald-400" : "text-zinc-500"}`} />
              <span className="truncate">Daftar Agenda Hari Ini</span>
            </button>

            <button
              onClick={() => setActiveTab("dashboard")}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left text-xs font-semibold tracking-wide transition-all border ${
                activeTab === "dashboard"
                  ? "bg-zinc-900 border-l-4 border-l-[#10B981] border-zinc-805 text-white shadow-lg"
                  : "text-zinc-400 border-transparent hover:bg-zinc-900/55 hover:text-zinc-200"
              }`}
            >
              <BarChart3 className={`w-4 h-4 ${activeTab === "dashboard" ? "text-emerald-400" : "text-zinc-500"}`} />
              <span className="truncate">Statistik & Motivasi</span>
            </button>

            <button
              onClick={() => setActiveTab("evaluation")}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left text-xs font-semibold tracking-wide transition-all border ${
                activeTab === "evaluation"
                  ? "bg-zinc-900 border-l-4 border-l-[#10B981] border-zinc-805 text-white shadow-lg"
                  : "text-zinc-400 border-transparent hover:bg-zinc-900/55 hover:text-zinc-200"
              }`}
            >
              <BrainCircuit className={`w-4 h-4 ${activeTab === "evaluation" ? "text-emerald-400" : "text-zinc-500"}`} />
              <span className="truncate">Evaluasi Performa</span>
            </button>

            <button
              onClick={() => setActiveTab("settings")}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left text-xs font-semibold tracking-wide transition-all border ${
                activeTab === "settings"
                  ? "bg-zinc-900 border-l-4 border-l-[#10B981] border-zinc-805 text-white shadow-lg"
                  : "text-zinc-400 border-transparent hover:bg-zinc-900/55 hover:text-zinc-200"
              }`}
            >
              <Settings className={`w-4 h-4 ${activeTab === "settings" ? "text-emerald-400" : "text-zinc-500"}`} />
              <span className="truncate">Pengaturan & Privasi</span>
            </button>
          </div>

          {/* Live Online/Offline Connection Mode Block */}
          <div className="pt-4 lg:pt-5 border-t border-zinc-900 mt-2 lg:mt-4 space-y-3 px-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block px-1">
              Status Koneksi Database
            </span>
            {user ? (
              <div className="p-3 bg-emerald-950/20 border border-emerald-900/30 rounded-xl space-y-2">
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Mode Online Aktif
                </div>
                <p className="text-[10px] text-zinc-400 leading-relaxed truncate">
                  Tersinkronisasi: <span className="text-zinc-200 font-medium">{user.email}</span>
                </p>
                <div className="flex gap-2 pt-1 font-sans">
                  <button
                    onClick={async () => {
                      await syncLocalDataToCloud(user.uid);
                      spawnNotification("🔄 Sinkronisasi Sukses", "Seluruh data lokal berhasil dicadangkan ke cloud!", "info");
                    }}
                    className="text-[9px] font-extrabold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-900/30 py-1 px-2 rounded-lg transition-colors cursor-pointer"
                  >
                    Sinkron Sekarang
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="text-[9px] font-extrabold bg-zinc-950 hover:bg-zinc-900 text-zinc-400 border border-zinc-800 py-1 px-2 rounded-lg transition-colors cursor-pointer"
                  >
                    Keluar
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-amber-950/10 border border-amber-900/20 rounded-xl space-y-2">
                <div className="flex items-center gap-1.5 text-amber-500 font-bold text-xs">
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  Mode Offline (Lokal)
                </div>
                <p className="text-[10px] text-zinc-400 leading-relaxed">
                  Data Anda tersimpan aman secara lokal di peramban ini.
                </p>
                <button
                  onClick={handleGoogleSignIn}
                  disabled={!firebaseReady}
                  className="w-full flex items-center justify-center gap-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-black font-extrabold text-[10px] py-1.5 px-3 rounded-lg transition-all cursor-pointer shadow-sm"
                >
                  <LogIn className="w-3 h-3" />
                  Aktifkan Mode Online
                </button>
              </div>
            )}

            <button
              onClick={requestBrowserNotificationPermission}
              className="text-emerald-500 hover:text-emerald-400 font-bold tracking-tight text-[10px] hover:underline mt-1 block cursor-pointer transition-colors px-1"
            >
              • Uji Notifikasi Pengingat
            </button>
          </div>
        </nav>

        {/* Core Rendering Container with React transitions */}
        <main className="lg:col-span-9 space-y-6">
          <AnimatePresence mode="wait">
            
            {/* TAB: PLANNER */}
            {activeTab === "planner" && (
              <motion.div
                key="planner"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
                className="space-y-6"
              >
                {/* AI setup personal recommendation planner */}
                <AIPersonalizer
                  key={"ai-personalizer-" + resetKey}
                  onScheduleGenerated={handleAIScheduleGenerated}
                  futureGoals={settings.futureGoals}
                  setFutureGoals={handleUpdateGoals}
                  selectedDate={selectedDate}
                  onCollegeDaysChange={setCollegeDays}
                />
              </motion.div>
            )}

            {/* TAB: SCHEDULE (DAFTAR AGENDA HARI INI) */}
            {activeTab === "schedule" && (
              <motion.div
                key="schedule"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
                className="space-y-6"
              >
                {/* Main Schedule Container */}
                <div className="bg-zinc-900/20 border border-zinc-800/80 rounded-2xl p-4 sm:p-6 shadow-md transition-colors space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900 pb-4">
                    <div>
                      <h2 className="text-md font-bold text-white font-sans">Daftar Agenda Hari Ini</h2>
                      <p className="text-xs text-zinc-500">Kelola kegiatan dan agenda harian Anda sesuai urutan waktu</p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="px-3.5 py-1.7 bg-zinc-950 text-xs font-bold rounded-xl border border-zinc-800 text-zinc-300 focus:outline-none focus:border-emerald-500"
                      />

                      <button
                        onClick={() => exportTasksToICS(tasks)}
                        disabled={tasks.length === 0}
                        className="flex items-center gap-1.5 px-3.5 py-1.7 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border border-zinc-800 disabled:opacity-30 text-xs font-semibold rounded-xl cursor-pointer transition-colors"
                        title="Ekspor Jadwal ke aplikasi Google Calendar"
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-555" /> Kalender (.ics)
                      </button>
                    </div>
                  </div>

                  {/* Info Status Row: Day and College Class Days info */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 bg-zinc-950/40 p-4 rounded-xl border border-zinc-850/60 leading-normal">
                    <div className="flex items-center gap-3">
                      <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10B981] animate-pulse" />
                      <div className="text-xs font-sans">
                        <span className="text-zinc-500 block text-[10px] uppercase font-extrabold tracking-wider mb-0.5">Hari Terpilih</span>
                        <span className="text-zinc-200 font-bold">{getIndonesianDayName(selectedDate)}, {formatIndonesianDate(selectedDate)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l border-zinc-900/80 pt-2.5 md:pt-0 md:pl-4">
                      <div className="p-1.5 rounded-lg bg-blue-950/20 border border-blue-900/30 text-blue-400 font-bold whitespace-nowrap">
                        <svg className="w-4 h-4 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      </div>
                      <div className="text-xs font-sans w-full">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-500 text-[10px] uppercase font-extrabold tracking-wider block mb-0.5">Hari Kuliah Anda</span>
                          {collegeDays.includes(getIndonesianDayName(selectedDate)) ? (
                            <span className="text-[9px] bg-blue-950/40 border border-blue-900/40 text-blue-400 px-1.5 py-0.2 rounded font-extrabold tracking-wider">
                              KULIAH AKTIF
                            </span>
                          ) : (
                            <span className="text-[9px] bg-emerald-950/30 border border-emerald-950/30 text-emerald-400 px-1.5 py-0.2 rounded font-extrabold tracking-wider">
                              LIBUR / BEBAS
                            </span>
                          )}
                        </div>
                        <span className="text-zinc-300 font-bold block max-w-full truncate" title={collegeDays.join(", ")}>
                          {collegeDays.length > 0 ? collegeDays.join(", ") : "Tidak ada kuliah / Belum disetel"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l border-zinc-900/80 pt-2.5 md:pt-0 md:pl-4">
                      <div className={`p-1.5 rounded-lg border ${
                        settings.autoAIPlannerEnabled 
                          ? "bg-emerald-950/20 border-emerald-950/40 text-emerald-400" 
                          : "bg-zinc-900 border-zinc-805 text-zinc-500"
                      }`}>
                        <Sparkles className={`w-4 h-4 ${settings.autoAIPlannerEnabled ? "animate-pulse" : ""}`} />
                      </div>
                      <div className="text-xs font-sans w-full leading-normal">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-500 text-[10px] uppercase font-extrabold tracking-wider block">AI Auto-Planner 00:00</span>
                          <button
                            type="button"
                            onClick={() => {
                              const currentUID = user ? user.uid : "local-user";
                              const updated: UserSettings = {
                                ...settings,
                                autoAIPlannerEnabled: !settings.autoAIPlannerEnabled
                              };
                              setSettings(updated);
                              saveUserSettings(currentUID, updated);
                              spawnNotification(
                                "🤖 AI Auto-Agenda",
                                updated.autoAIPlannerEnabled 
                                  ? "Pembuat jadwal harian otomatis pukul 00:00 berhasil diaktifkan!" 
                                  : "Pembuat jadwal harian otomatis dinonaktifkan.",
                                "info"
                              );
                            }}
                            className={`text-[9px] px-2 py-0.5 rounded font-black tracking-wider transition-all cursor-pointer ${
                              settings.autoAIPlannerEnabled 
                                ? "bg-emerald-500 text-black hover:bg-emerald-600 font-extrabold scale-105" 
                                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                            }`}
                          >
                            {settings.autoAIPlannerEnabled ? "AKTIF" : "MATI"}
                          </button>
                        </div>
                        <span className="text-[10px] text-zinc-450 font-medium block truncate max-w-[210px] mt-0.5" title={settings.autoAIPlannerEnabled ? "Merancang agenda cerdas otomatis setiap 00:00." : "Sistem mati. Klik tombol untuk menyalakan."}>
                          {settings.autoAIPlannerEnabled 
                            ? "Rancang agenda otomatis setiap jam 00:00." 
                            : "Sistem mati. Klik tombol untuk menyalakan."}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* E2E lock blocker */}
                  {settings.e2eEnabled && !isE2eUnlocked ? (
                    <div className="py-12 text-center max-w-md mx-auto space-y-4">
                      <Lock className="w-9 h-9 text-purple-400 mx-auto animate-pulse" />
                      <h3 className="text-sm font-bold text-zinc-200">Data Terenkripsi End-to-End</h3>
                      <p className="text-xs text-zinc-500">
                        Agenda harian Anda dilindungi oleh enkripsi zero-knowledge pada database. Masukkan kunci sandi rahasia untuk mendekripsi dan membacanya di peramban ini.
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          placeholder="Masukkan kata sandi enkripsi"
                          value={e2eInputPassword}
                          onChange={(e) => setE2eInputPassword(e.target.value)}
                          className="flex-1 px-4 py-2.5 bg-zinc-950 text-xs rounded-xl focus:outline-none border border-zinc-805 text-zinc-100 placeholder-zinc-700"
                        />
                        <button
                          onClick={() => {
                            if (e2eInputPassword.trim() !== "") {
                              setIsE2eUnlocked(true);
                              spawnNotification("🔓 E2E Dibuka", "Kunci pengaman dibuka. Data berhasil ter-dekripsi.", "achievement");
                            }
                          }}
                          className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-bold rounded-xl transition-all shadow-md"
                        >
                          Buka Kunci
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Form add task */}
                      <form onSubmit={handleAddTask} className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 bg-zinc-900/40 p-4 rounded-xl border border-zinc-800/60 transition-all">
                        <div className="col-span-12 sm:col-span-3">
                          <label className="block text-[10px] uppercase font-bold tracking-widest text-emerald-500 mb-1.5 font-sans">Judul Agenda</label>
                          <input
                            type="text"
                            placeholder="Contoh: Belajar Pemrograman Rust"
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            className="w-full px-3 py-2 border border-zinc-800 bg-zinc-950 text-xs text-zinc-200 placeholder-zinc-650 rounded-xl focus:outline-none focus:border-emerald-500"
                            required
                          />
                        </div>

                        <div className="col-span-12 sm:col-span-3">
                          <label className="block text-[10px] uppercase font-bold tracking-widest text-emerald-500 mb-1.5 leading-none">Catatan Ringkas</label>
                          <input
                            type="text"
                            placeholder="Tips, target, lokasi..."
                            value={newTaskNotes}
                            onChange={(e) => setNewTaskNotes(e.target.value)}
                            className="w-full px-3 py-2 border border-zinc-800 bg-zinc-950 text-xs text-zinc-200 placeholder-zinc-650 rounded-xl focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div className="col-span-6 sm:col-span-2">
                          <label className="block text-[10px] uppercase font-bold tracking-widest text-emerald-500 mb-1.5 leading-none">Mulai</label>
                          <input
                            type="time"
                            value={newTaskStart}
                            onChange={(e) => setNewTaskStart(e.target.value)}
                            className="w-full px-2 py-1.5 border border-zinc-800 bg-zinc-950 text-xs text-zinc-200 rounded-xl focus:outline-none focus:border-emerald-500"
                            required
                          />
                        </div>

                        <div className="col-span-6 sm:col-span-2">
                          <label className="block text-[10px] uppercase font-bold tracking-widest text-[#10B981] mb-1.5 leading-none">Selesai</label>
                          <input
                            type="time"
                            value={newTaskEnd}
                            onChange={(e) => setNewTaskEnd(e.target.value)}
                            className="w-full px-2 py-1.5 border border-zinc-800 bg-zinc-950 text-xs text-zinc-200 rounded-xl focus:outline-none focus:border-emerald-500"
                            required
                          />
                        </div>

                        <div className="col-span-12 sm:col-span-2">
                          <label className="block text-[10px] uppercase font-bold tracking-widest text-[#10B981] mb-1.5 leading-none">Kategori</label>
                          <select
                            value={newTaskRoutine}
                            onChange={(e) => setNewTaskRoutine(e.target.value as any)}
                            className="w-full px-2.5 py-2 bg-zinc-950 border border-zinc-800 text-xs rounded-xl text-zinc-350 focus:outline-none focus:border-emerald-500"
                          >
                            <option value="work">Kerja (Fokus)</option>
                            <option value="leisure">Waktu Luang</option>
                            <option value="habit">Kebiasaan</option>
                          </select>
                        </div>

                        <div className="sm:col-span-12 flex justify-end">
                          <button
                            type="submit"
                            className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-black font-extrabold text-xs py-2 px-4 rounded-xl transition-all shadow-md cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5 stroke-[2.5]" /> Tambah Agenda
                          </button>
                        </div>
                      </form>

                       {/* Display task collection */}
                      {tasks.length === 0 ? (
                        <div className="text-center py-12 border border-dashed border-zinc-800 rounded-xl bg-zinc-950/10">
                          <p className="text-xs text-zinc-500">Tidak ada agenda dijadwalkan untuk hari ini. Gunakan rancang AI di atas!</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {tasks
                            .slice()
                            .sort((a, b) => a.startTime.localeCompare(b.startTime))
                            .map((task) => (
                              <div
                                key={task.id}
                                className={`group p-4 rounded-xl border flex items-center justify-between transition-all ${
                                  task.completed
                                    ? "bg-zinc-950/40 border-emerald-950/50 border-l-4 border-l-emerald-500 opacity-65"
                                    : "bg-zinc-900/40 border-zinc-850 border-l-4 border-l-zinc-700 hover:border-zinc-700"
                                }`}
                              >
                                <div className="flex items-start gap-1 flex-1 pr-4">
                                  <button
                                    onClick={() => handleToggleTask(task)}
                                    className="w-11 h-11 -mt-1.5 -ml-2 flex items-center justify-center shrink-0 rounded-full hover:bg-zinc-800/40 text-zinc-400 hover:text-emerald-400 active:scale-90 transition-all cursor-pointer select-none"
                                    aria-label={task.completed ? "Tandai Belum Selesai" : "Tandai Selesai"}
                                  >
                                    <div className={`w-5.5 h-5.5 rounded-md flex items-center justify-center border transition-all ${
                                      task.completed
                                        ? "bg-emerald-500 border-emerald-555 text-black"
                                        : "bg-zinc-950 border-zinc-800"
                                    }`}>
                                      {task.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                    </div>
                                  </button>

                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-mono font-bold bg-zinc-950 border border-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                                        {task.startTime} - {task.endTime}
                                      </span>
                                      
                                      {(() => {
                                        const tagInfo = getTaskTagInfo(task);
                                        return (
                                          <span className={`text-[9px] uppercase font-extrabold px-1.5 py-0.2 rounded tracking-wide border ${tagInfo.badgeClass}`}>
                                            {tagInfo.label}
                                          </span>
                                        );
                                      })()}
                                    </div>
                                    <h3 className={`text-xs font-bold ${task.completed ? "line-through text-zinc-550" : "text-zinc-100"}`}>
                                      {task.title}
                                    </h3>
                                    {task.notes && (
                                      <p className="text-[10px] text-zinc-500 leading-relaxed font-medium">{task.notes}</p>
                                    )}
                                  </div>
                                </div>

                                <button
                                  onClick={() => handleDeleteTask(task.id)}
                                  className="p-1.5 text-zinc-600 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                                  title="Hapus Agenda"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                        </div>
                      )}

                      {/* Section: Reset & Clear Agenda Data */}
                      <div className="pt-5 border-t border-zinc-900 mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="space-y-0.5">
                          <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest font-sans">Menu Pembersihan Data</h4>
                          <p className="text-[10px] text-zinc-500 leading-normal">Bersihkan agenda hari ini saja atau setel ulang seluruh database jadwal Anda.</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {/* Button Clear Today */}
                          {!showClearTodayConfirm ? (
                            <button
                              type="button"
                              onClick={() => {
                                setShowClearTodayConfirm(true);
                                setShowResetAllConfirm(false);
                              }}
                              className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-red-900/30 text-rose-400 hover:text-rose-400 text-xs font-semibold rounded-xl cursor-pointer transition-all flex items-center gap-1.5"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Hapus Agenda Hari Ini
                            </button>
                          ) : (
                            <div className="flex items-center gap-1.5 p-1.5 bg-red-950/20 border border-red-900/30 rounded-xl">
                              <span className="text-[10px] font-bold text-red-400 px-1 font-sans">Yakin hapus semua agenda hari ini?</span>
                              <button
                                type="button"
                                onClick={handleClearAllTasksToday}
                                className="px-2.5 py-1.5 bg-red-500 hover:bg-red-600 text-black text-[10px] font-extrabold rounded-lg cursor-pointer"
                              >
                                Ya, Hapus
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowClearTodayConfirm(false)}
                                className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-[10px] font-bold rounded-lg cursor-pointer"
                              >
                                Batal
                              </button>
                            </div>
                          )}

                          {/* Button Reset All */}
                          {!showResetAllConfirm ? (
                            <button
                              type="button"
                              onClick={() => {
                                setShowResetAllConfirm(true);
                                setShowClearTodayConfirm(false);
                              }}
                              className="px-3.5 py-2 bg-red-950/10 hover:bg-red-950/20 border border-red-900/30 hover:border-red-900 text-red-400 text-xs font-bold rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-sm"
                            >
                              <RefreshCw className="w-3.5 h-3.5" /> Setel Ulang Semua
                            </button>
                          ) : (
                            <div className="flex items-center gap-1.5 p-1.5 bg-red-950/40 border border-red-900/50 rounded-xl">
                              <span className="text-[10px] font-bold text-red-400 px-1 font-sans">⚠️ Hapus SELURUH agenda semua hari?</span>
                              <button
                                type="button"
                                onClick={handleResetAllTasks}
                                className="px-2.5 py-1.5 bg-red-500 hover:bg-red-600 text-black text-[10px] font-extrabold rounded-lg cursor-pointer animate-pulse"
                              >
                                Ya, Reset Total
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowResetAllConfirm(false)}
                                className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-[10px] font-bold rounded-lg cursor-pointer"
                              >
                                Batal
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            )}

            {/* TAB: DASHBOARD */}
            {activeTab === "dashboard" && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
              >
                <WeeklyDashboard
                  userId={user ? user.uid : "local-user"}
                  futureGoals={settings.futureGoals}
                  completedTasksCount={completedTasksCount}
                  totalTasksCount={totalTasksCount}
                  totalFocusMinutes={statsSummaryMin.focus}
                  totalRestMinutes={statsSummaryMin.rest}
                  totalDistractionMinutes={statsSummaryMin.distraction}
                  motivationQuote={motivationQuote}
                  onUpdateMotivation={setMotivationQuote}
                  selectedDate={selectedDate}
                />
              </motion.div>
            )}

            {/* TAB: EVALUATION */}
            {activeTab === "evaluation" && (
              <motion.div
                key="evaluation"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
              >
                <PerformanceReview
                  userId={user ? user.uid : "local-user"}
                  futureGoals={settings.futureGoals}
                  monthlyEvaluations={monthlyEvaluations}
                  onSaveEvaluation={handleSaveEvaluation}
                  tasksCompletedCount={completedTasksCount}
                  totalTasksCount={totalTasksCount}
                  averageFocusTime={statsSummaryMin.focus}
                />
              </motion.div>
            )}

            {/* TAB: SETTINGS & EXPORTS */}
            {activeTab === "settings" && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
                className="space-y-6"
              >
                {/* Mode Online / Cloud Sync Block */}
                <div className="bg-zinc-900/20 border border-zinc-800/80 rounded-2xl p-6 shadow-md space-y-4 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-emerald-950/20 text-[#10B981] border border-emerald-900/30 rounded-xl">
                        <RefreshCw className="w-5 h-5 animate-spin-slow text-emerald-450" />
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-white">Mode Online & Sinkronisasi Cloud</h2>
                        <p className="text-xs text-zinc-400">Hubungkan ke database Firestore untuk penyimpanan awan secara real-time.</p>
                      </div>
                    </div>
                    <div>
                      <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full ${
                        user ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                      }`}>
                        {user ? "Mode Online" : "Mode Offline"}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 bg-zinc-950/45 border border-zinc-900 rounded-xl space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-xs font-bold text-zinc-100">Hubungkan Akun Google Anda</h3>
                        <p className="text-[11px] text-zinc-500 max-w-md font-sans leading-relaxed">
                          {user 
                            ? `Tersambung sebagai ${user.email}. Semua data jadwal dan log langsung dicadangkan secara instan.`
                            : "Gunakan Akun Google untuk mengaktifkan Mode Online dan mencadangkan data secara otomatis."
                          }
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {user ? (
                          <button
                            onClick={handleSignOut}
                            className="bg-zinc-900 hover:bg-zinc-850 hover:text-white text-zinc-300 font-extrabold text-xs py-2 px-4 rounded-xl border border-zinc-805 transition-colors cursor-pointer"
                          >
                            Keluar Akun (Offline Mode)
                          </button>
                        ) : (
                          <button
                            onClick={handleGoogleSignIn}
                            disabled={!firebaseReady}
                            className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-black font-extrabold text-xs py-2 px-4 rounded-xl shadow-md transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            <LogIn className="w-3.5 h-3.5" />
                            Aktifkan Mode Online
                          </button>
                        )}
                      </div>
                    </div>

                    {user && (
                      <div className="border-t border-zinc-900 pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs leading-none">
                        <span className="text-zinc-500 text-[11px] flex items-center gap-1.5 font-sans">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Database Firestore tersambung dan siap disinkron.
                        </span>
                        <button
                          onClick={async () => {
                            await syncLocalDataToCloud(user.uid);
                            spawnNotification("🔄 Sinkronisasi Sukses", "Berhasil menyelaraskan seluruh histori data Anda ke cloud secara instan!", "info");
                          }}
                          className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-850 text-emerald-400 border border-zinc-800 hover:border-emerald-950/30 font-extrabold text-[11px] rounded-lg transition-colors cursor-pointer"
                        >
                          Lakukan Sinkronisasi Manual
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* E2E controls */}
                <div className="bg-zinc-900/20 border border-zinc-800/80 rounded-2xl p-6 shadow-md space-y-4 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-purple-950/20 text-purple-400 border border-purple-900/30 rounded-xl">
                      <Lock className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-white">Keamanan Enkripsi End-to-End (E2E)</h2>
                      <p className="text-xs text-zinc-400">Kriptografi sisi klien: Kunci sandi tidak pernah dikirim ke database cloud.</p>
                    </div>
                  </div>

                  <div className="p-4 bg-zinc-950/45 border border-zinc-900 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xs font-bold text-zinc-200">Aktifkan Enkripsi Data Agenda</h3>
                      <p className="text-[11px] text-zinc-500 max-w-md">Ketika aktif, semua judul dan catatan tugas dienkripsi pada peramban sebelum disinkronkan ke Firebase.</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleE2E(!settings.e2eEnabled)}
                        className={`text-xs font-bold py-2 px-4 rounded-xl border transition-all cursor-pointer ${
                          settings.e2eEnabled
                            ? "bg-purple-600 hover:bg-purple-700 border-purple-500 text-white shadow-xs"
                            : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:hover:bg-zinc-850"
                        }`}
                      >
                        {settings.e2eEnabled ? "🛡️ Aktif" : "Mati"}
                      </button>
                    </div>
                  </div>

                  {settings.e2eEnabled && (
                    <div className="p-4 bg-purple-950/10 border border-purple-900/40 rounded-xl max-w-xl text-xs gap-2.5 flex flex-col">
                      <div className="flex items-center gap-1.5 font-bold text-purple-300">
                        <Lock className="w-4 h-4" /> Masukkan / Konfirmasi Sandi E2E Anda:
                      </div>
                      <input
                        type="password"
                        placeholder="Contoh: sandirahasiametadata123"
                        value={e2eInputPassword}
                        onChange={(e) => {
                          setE2eInputPassword(e.target.value);
                          if (e.target.value.trim() !== "") {
                            setIsE2eUnlocked(true);
                          } else {
                            setIsE2eUnlocked(false);
                          }
                        }}
                        className="w-full mt-1.5 px-3.5 py-2.5 bg-zinc-950 border border-zinc-850 text-zinc-200 rounded-xl placeholder-zinc-700 focus:outline-none focus:border-purple-500"
                      />
                      <p className="text-[10px] text-zinc-500 mt-1 block">Sandi ini disimpan murni sementara di RAM peramban lokal dan digunakan meluncurkan dekripsi / enkripsi. Jangan sampai lupa!</p>
                    </div>
                  )}
                </div>

                {/* AI Auto Scheduler Controls */}
                <div className="bg-zinc-900/20 border border-zinc-800/80 rounded-2xl p-6 shadow-md space-y-4 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-950/20 text-emerald-400 border border-emerald-900/30 rounded-xl font-bold whitespace-nowrap">
                      <Sparkles className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-white">Pembuat Jadwal AI Otomatis (Jam 00:00)</h2>
                      <p className="text-xs text-zinc-400">Merancang dan mengisi jadwal harian produktif Anda secara otomatis setiap pergantian hari.</p>
                    </div>
                  </div>

                  <div className="p-4 bg-zinc-950/45 border border-zinc-900 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h3 className="text-xs font-bold text-zinc-200">Aktifkan Pembuatan Jadwal Otomatis</h3>
                      <p className="text-[11px] text-zinc-500 max-w-md leading-relaxed font-sans">
                        Saat aktif, sistem akan mendeteksi pergantian hari pada pukul 00:00 (atau saat pertama kali aplikasi dibuka di hari yang baru) dan otomatis merekomendasikan daftar agenda terbaik berdasarkan profil personalisasi studi, hobi, dan cita-cita Anda.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const currentUID = user ? user.uid : "local-user";
                          const updated = {
                            ...settings,
                            autoAIPlannerEnabled: !settings.autoAIPlannerEnabled
                          };
                          setSettings(updated);
                          saveUserSettings(currentUID, updated);
                          spawnNotification(
                            "🤖 AI Auto-Agenda",
                            updated.autoAIPlannerEnabled 
                              ? "Pembuat jadwal harian otomatis pukul 00:00 berhasil diaktifkan!" 
                              : "Pembuat jadwal harian otomatis dinonaktifkan.",
                            "info"
                          );
                        }}
                        className={`text-xs font-extrabold py-2 px-4 rounded-xl border transition-all cursor-pointer ${
                          settings.autoAIPlannerEnabled
                            ? "bg-emerald-500 hover:bg-emerald-600 border-emerald-400 text-black shadow-xs"
                            : "bg-zinc-900 border-zinc-850 text-zinc-400 hover:bg-zinc-850"
                        }`}
                      >
                        {settings.autoAIPlannerEnabled ? "⚡ AKTIF" : "MATI"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* CSV export */}
                <div className="bg-zinc-900/20 border border-zinc-800/80 rounded-2xl p-6 shadow-md space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-950/20 text-emerald-400 border border-emerald-900/30 rounded-xl">
                      <Download className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-white">Ekspor Seluruh Progres Pengguna</h2>
                      <p className="text-xs text-zinc-400">Backup seluruh data jadwal dan monitor produktivitas harian Anda.</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-zinc-950/45 border border-zinc-900 rounded-xl">
                    <div>
                      <h3 className="text-xs font-bold text-zinc-200">Ekspor Format CSV</h3>
                      <p className="text-[11px] text-zinc-500">Unduh berkas .csv berisi seluruh tabel kompilasi kemajuan mingguan Anda.</p>
                    </div>

                    <button
                      onClick={() => exportDataToCSV(getLocalTasks(), getLocalLogs())}
                      className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 font-extrabold px-4 py-2.5 text-black text-xs rounded-xl cursor-pointer transition-colors shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" /> Unduh Berkas CSV
                    </button>
                  </div>
                </div>

              </motion.div>
            )}

          </AnimatePresence>
        </main>

      </div>

      {/* Packaged / Tauri Desktop Google Client Auth Limit Info Drawer/Modal */}
      <AnimatePresence>
        {showTauriHelpModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 sm:p-6"
            onClick={() => setShowTauriHelpModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 20, opacity: 0 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="bg-zinc-950 border border-zinc-850 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl relative p-6 sm:p-7 space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-4 pb-3 border-b border-zinc-900">
                <div className="p-3 bg-rose-950/20 text-rose-400 border border-rose-900/40 rounded-2xl">
                  <Lock className="w-5 h-5 animate-pulse text-rose-400" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white tracking-wide uppercase">
                    Batasan Google Login (.EXE / Desktop)
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Google OAuth membatasi login di dalam container WebView tersemat.
                  </p>
                </div>
              </div>

              <div className="text-xs text-zinc-300 space-y-3 leading-relaxed">
                <p>
                  Halo! Kami mendeteksi Anda sedang menjalankan aplikasi ini dalam format <span className="text-[#10B981] font-bold">versi desktop terkompilasi (.EXE / Tauri)</span> atau peramban yang memblokir jendela popup.
                </p>
                <p>
                  Sesuai kebijakan keamanan terbaru Google, <span className="font-bold text-zinc-100">Google OAuth secara ketat memblokir login popup di dalam WebView</span> aplikasi eksternal guna menghentikan ancaman pembajakan data. Agar Anda mendapatkan kemudahan penuh, kami menyediakan dua opsi yang sama-sama tangguh:
                </p>
              </div>

              {/* OPTION 1: Use Web Browser For Synced Experience */}
              <div className="bg-zinc-900/30 border border-zinc-850/50 p-4 rounded-2xl space-y-3 font-sans">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#10B981]">
                    Opsi 1: Rekomendasi Sinkronisasi Awan
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-normal">
                  Salin salah satu tautan di bawah lalu buka di browser standar (Chrome, Firefox, Safari) di laptop Anda. Di sana, login Google berjalan lancar 100%!
                </p>

                <div className="space-y-2 mt-2">
                  {/* Link 1: Shared link */}
                  <div className="flex items-center justify-between p-2 bg-zinc-950 border border-zinc-900 rounded-xl gap-2">
                    <div className="truncate flex-1">
                      <span className="text-[8px] text-zinc-500 block uppercase font-extrabold">Link Utama (Shared URL)</span>
                      <span className="text-[9px] font-mono font-bold text-zinc-300 truncate block">ais-pre-dgthiymkedpazxd...</span>
                    </div>
                    <button
                      onClick={() => handleCopyLink("https://ais-pre-dgthiymkedpazxdggahyhw-191937967657.asia-east1.run.app", "pre")}
                      className="text-[10px] font-extrabold bg-[#10B981] text-black px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-emerald-400 transition-all shadow-sm flex items-center gap-1 shrink-0"
                    >
                      {copiedStates["pre"] ? (
                        <>
                          <Check className="w-3 h-3" /> Tersalin
                        </>
                      ) : (
                        "Salin Link"
                      )}
                    </button>
                  </div>

                  {/* Link 2: Dev link */}
                  <div className="flex items-center justify-between p-2 bg-zinc-950 border border-zinc-900 rounded-xl gap-2">
                    <div className="truncate flex-1">
                      <span className="text-[8px] text-zinc-500 block uppercase font-extrabold">Link Alternatif (Dev URL)</span>
                      <span className="text-[9px] font-mono font-bold text-zinc-300 truncate block">ais-dev-dgthiymkedpazxd...</span>
                    </div>
                    <button
                      onClick={() => handleCopyLink("https://ais-dev-dgthiymkedpazxdggahyhw-191937967657.asia-east1.run.app", "dev")}
                      className="text-[10px] font-extrabold bg-[#10B981] text-black px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-emerald-400 transition-all shadow-sm flex items-center gap-1 shrink-0"
                    >
                      {copiedStates["dev"] ? (
                        <>
                          <Check className="w-3 h-3" /> Tersalin
                        </>
                      ) : (
                        "Salin Link"
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* OPTION 2: Offline Local E2E Encryption */}
              <div className="p-4 bg-purple-950/10 border border-purple-900/30 rounded-2xl space-y-1.5 font-sans">
                <div className="flex items-center gap-1.5 text-purple-400 font-bold text-[10px] uppercase tracking-widest">
                  <Unlock className="w-3 h-3 text-purple-400" /> Opsi 2: Keamanan Enkripsi Lokal (Offline)
                </div>
                <p className="text-[11px] text-zinc-400 leading-normal">
                  Seluruh riwayat, agenda, timer fokus, visualisasi, dan evaluasi AI Anda tetap berfungsi secara utuh langsung di komputer Anda. Untuk keamanan tingkat militer, silakan aktifkan <span className="text-purple-400 font-bold">Enkripsi E2E AES lokal</span> di menu Pengaturan. Progres Anda akan langsung terenkripsi rapat menggunakan sandi pribadi Anda!
                </p>
              </div>

              {/* Action Buttons to collapse */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowTauriHelpModal(false)}
                  className="w-full py-2.5 border border-zinc-800 text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-850 font-bold text-xs rounded-xl cursor-pointer transition-colors shadow-sm text-center"
                >
                  Gunakan Mode Offline
                </button>
                <a
                  href="https://ais-pre-dgthiymkedpazxdggahyhw-191937967657.asia-east1.run.app"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-indigo-600 text-white font-extrabold text-xs rounded-xl hover:from-emerald-400 transition-colors shadow-md text-center flex items-center justify-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" /> Buka di Browser
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showRoastPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-md z-[99999] flex items-center justify-center p-3 sm:p-4 overflow-hidden"
            onClick={() => setShowRoastPopup(false)}
          >
            <motion.div
              initial={{ scale: 0.92, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.92, y: 15, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 border border-rose-900/40 rounded-2xl sm:rounded-3xl p-5 sm:p-7 max-w-sm sm:max-w-md w-full max-h-[92vh] overflow-hidden shadow-[0_24px_60px_rgba(244,63,94,0.22)] flex flex-col gap-4 sm:gap-5 text-center relative font-sans"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Backglow elements */}
              <div className="absolute -top-12 -left-12 w-32 h-32 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

              {/* Close Button Top Right */}
              <button
                onClick={() => setShowRoastPopup(false)}
                className="absolute top-3.5 right-3.5 p-1.5 rounded-lg text-zinc-500 hover:text-zinc-205 hover:bg-zinc-900 w-8 h-8 flex items-center justify-center transition-all cursor-pointer"
                title="Tutup"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Character Header */}
              <div className="mx-auto p-3 bg-rose-950/25 text-rose-500 border border-rose-900/30 rounded-2xl w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center text-2xl sm:text-3xl font-extrabold font-sans animate-bounce">
                🌶️
              </div>

              <div className="space-y-0.5">
                <span className="text-[9px] sm:text-[10px] font-bold tracking-widest text-rose-455 uppercase block">
                  DailyFlow AI Roaster
                </span>
                <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Sentilan Roster Pedas! 🔥
                </h3>
              </div>

              {/* Stats Mini Panel */}
              <div className="grid grid-cols-2 gap-2 bg-zinc-950/60 p-3 rounded-xl sm:rounded-2xl border border-zinc-905 text-left font-sans text-[11px] sm:text-xs">
                <div className="col-span-2 border-b border-zinc-900/80 pb-2 mb-0.5">
                  <span className="text-[8px] sm:text-[9px] text-zinc-500 block uppercase font-bold tracking-wide">Target Masa Depan</span>
                  <span className="text-zinc-200 font-bold tracking-wide truncate block">
                    "{settings.futureGoals || "Sukses Mulia"}"
                  </span>
                </div>
                <div>
                  <span className="text-[8px] text-zinc-500 block uppercase font-bold tracking-wide">Agenda Selesai</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {tasks.filter(t => t.completed).length} <span className="text-[9px] sm:text-[10px] text-zinc-650">/ {tasks.length}</span>
                  </span>
                </div>
                <div>
                  <span className="text-[8px] text-zinc-500 block uppercase font-bold tracking-wide">Waktu Fokus</span>
                  <span className="font-mono font-bold text-indigo-400">
                    {activityLogs.reduce((acc, curr) => curr.type === "focus" ? acc + curr.durationMinutes : acc, 0)} <span className="text-[9px] sm:text-[10px] text-zinc-650">menit</span>
                  </span>
                </div>
              </div>

              {/* Speech bubble */}
              <div className="relative min-h-[90px] sm:min-h-[100px] flex items-center justify-center overflow-hidden">
                {loadingRoastPopup ? (
                  <div className="flex flex-col items-center justify-center gap-2 p-4 text-zinc-500">
                    <RefreshCw className="w-5 h-5 animate-spin text-rose-500" />
                    <span className="text-[9px] sm:text-[10px] font-bold tracking-wider uppercase animate-pulse">Menghangatkan wajan sambal...</span>
                  </div>
                ) : (
                  <div className="w-full max-h-[180px] sm:max-h-[220px] overflow-y-auto custom-scrollbar pr-2.5 text-zinc-200 text-xs italic font-medium leading-relaxed bg-zinc-900/60 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-zinc-905 relative text-left">
                    "{roastPopupContent}"
                  </div>
                )}
              </div>

              {/* Footer actions */}
              <div className="flex flex-col sm:flex-row gap-2 mt-1 sm:mt-2">
                <button
                  type="button"
                  disabled={loadingRoastPopup}
                  onClick={fetchInitialRoast}
                  className="flex-1 py-2 sm:py-2.5 bg-gradient-to-r from-rose-950/50 to-amber-950/20 border border-rose-900/30 text-rose-400 font-bold text-[11px] sm:text-xs rounded-xl hover:text-rose-300 transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingRoastPopup ? "animate-spin" : ""}`} />
                  Beri Semburan Baru 🔥
                </button>
                <button
                  type="button"
                  onClick={() => setShowRoastPopup(false)}
                  className="flex-1 py-2 sm:py-2.5 bg-gradient-to-r from-rose-500 to-amber-600 text-white font-extrabold text-[11px] sm:text-xs rounded-xl hover:from-rose-400 transition-all shadow-md text-center"
                >
                  Aduh, Tobat & Mulai! 🙏
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
