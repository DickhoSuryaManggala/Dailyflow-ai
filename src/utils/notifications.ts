import { Task } from "../types";

// In-app notifications container type
export interface ActiveNotification {
  id: string;
  title: string;
  message: string;
  timestamp: number;
  type: "info" | "alert" | "leisure" | "achievement";
  read: boolean;
}

// Global notifications list for app state callback
let notificationsBuffer: ActiveNotification[] = [];
let changeCallbacks: (() => void)[] = [];

export function getNotifications(): ActiveNotification[] {
  return notificationsBuffer;
}

export function addOnNotificationChange(callback: () => void) {
  changeCallbacks.push(callback);
}

export function removeOnNotificationChange(callback: () => void) {
  changeCallbacks = changeCallbacks.filter(cb => cb !== callback);
}

function notifyListeners() {
  changeCallbacks.forEach(cb => cb());
}

/**
 * Request real browser notification permission if available
 */
export async function requestBrowserNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  try {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  } catch (e) {
    return false;
  }
}

/**
 * Play a synthesized premium chime sound using Web Audio API
 * This ensures no external dependencies are broken in container / offline environments
 */
export function playChime(type: "soft" | "success" | "alert" = "soft") {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "success") {
      // Warm rising major arpeggio
      osc.type = "triangle";
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
      osc.frequency.setValueAtTime(1046.50, now + 0.3); // C6
      
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.start(now);
      osc.stop(now + 0.6);
    } else if (type === "alert") {
      // Alert chime (urgent dual-tone)
      osc.type = "sine";
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(880, now); // A5
      osc.frequency.setValueAtTime(783.99, now + 0.15); // G5
      
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    } else {
      // Soft gentle reminder chime
      osc.type = "sine";
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(659.25, now); // E5
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
    }
  } catch (error) {
    console.warn("Audio playback not yet allowed or enabled by browser context constraints:", error);
  }
}

/**
 * Dispatch an in-app notice and trigger native notification if allowed
 */
export function spawnNotification(
  title: string,
  message: string,
  type: "info" | "alert" | "leisure" | "achievement" = "info"
) {
  // 1. Add to active buffer
  const item: ActiveNotification = {
    id: Math.random().toString(36).substr(2, 9),
    title,
    message,
    timestamp: Date.now(),
    type,
    read: false,
  };

  notificationsBuffer = [item, ...notificationsBuffer].slice(0, 50); // limit to last 50
  notifyListeners();

  // 2. Play chime
  if (type === "achievement") {
    playChime("success");
  } else if (type === "alert") {
    playChime("alert");
  } else {
    playChime("soft");
  }

  // 3. Try legacy standard Browser push notification if permissions exist
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, {
        body: message,
        icon: "/favicon.ico",
      });
    }
  } catch (e) {
    // Silently fall back within sandboxed iframe structures
  }
}

/**
 * Periodically evaluate tasks for upcoming notification alarms
 */
let lastEvaluatedMinute = "";

export function tickNotificationScheduler(tasks: Task[], freeTimeRanges: string[]) {
  const now = new Date();
  const currentHour = now.getHours().toString().padStart(2, "0");
  const currentMin = now.getMinutes().toString().padStart(2, "0");
  const currentTimeStr = `${currentHour}:${currentMin}`;

  if (currentTimeStr === lastEvaluatedMinute) return;
  lastEvaluatedMinute = currentTimeStr;

  // 1. Task Reminders: trigger 5 minutes before task begins or exactly at start time
  tasks.forEach(task => {
    if (task.completed) return;

    if (task.startTime === currentTimeStr) {
      spawnNotification(
        `▶ Saatnya Memulai: ${task.title}`,
        `Aktivitas dijadwalkan sekarang (${task.startTime} - ${task.endTime}). Yuk lakukan!`,
        task.routine === "leisure" ? "leisure" : "info"
      );
    }
  });

  // 2. Free Time Alarms (Rutinitas waktu luang saya):
  // Let's trigger custom sweet alerts reminding them to rest exactly when a freeTimeRange starts!
  freeTimeRanges.forEach(range => {
    const [start, end] = range.split("-");
    if (start === currentTimeStr) {
      spawnNotification(
        "🌸 Masuk Waktu Luang Anda",
        `Saatnya bersantai atau melakukan hobi sejenak! Porsi waktu luang Anda resmi dimulai sampai ${end}.`,
        "leisure"
      );
    }
  });
}

export function clearNotifications() {
  notificationsBuffer = [];
  notifyListeners();
}

export function markAsRead(id: string) {
  notificationsBuffer = notificationsBuffer.map(item =>
    item.id === id ? { ...item, read: true } : item
  );
  notifyListeners();
}
