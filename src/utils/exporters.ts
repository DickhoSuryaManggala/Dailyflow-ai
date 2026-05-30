import { Task, ActivityLog } from "../types";

/**
 * Clean helper to sanitize CSV fields and wrap in quotes
 */
function sanitizeCsv(val: any): string {
  const str = String(val || "").replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Export tasks and monitor logs to CSV file
 */
export function exportDataToCSV(tasks: Task[], logs: ActivityLog[]) {
  // 1. Generate Tasks CSV
  let csvContent = "data:text/csv;charset=utf-8,";
  
  csvContent += "=== JADWAL HARIAN ===\n";
  csvContent += "ID,Tanggal,Jam Mulai,Jam Selesai,Judul Kegiatan,Kategori,Status Selesai,Dibuat Pada\n";
  
  tasks.forEach(task => {
    const row = [
      task.id,
      task.date,
      task.startTime,
      task.endTime,
      task.title,
      task.routine,
      task.completed ? "Selesai" : "Belum",
      new Date(task.createdAt).toLocaleString("id-ID"),
    ];
    csvContent += row.map(sanitizeCsv).join(",") + "\n";
  });
  
  csvContent += "\n=== MONITOR AKTIVITAS PRODUKTIVITAS ===\n";
  csvContent += "ID,Tanggal,Nama Kegiatan,Kategori,Durasi (Menit),Waktu Log\n";
  
  logs.forEach(log => {
    const row = [
      log.id,
      log.date,
      log.activityName,
      log.type,
      log.durationMinutes,
      new Date(log.timestamp).toLocaleString("id-ID"),
    ];
    csvContent += row.map(sanitizeCsv).join(",") + "\n";
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `dailyflow_data_${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Export scheduled tasks to an iCalendar (.ics) format file
 */
export function exportTasksToICS(tasks: Task[]) {
  if (tasks.length === 0) return;

  let icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DailyFlow AI//Indonesian Planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ].join("\r\n") + "\r\n";

  tasks.forEach(task => {
    // Generate dates based on local schedule settings
    const cleanDate = task.date.replace(/-/g, ""); // YYYYMMDD
    const startHourMin = task.startTime.replace(/:/g, "") + "00"; // HHMMSS
    const endHourMin = task.endTime.replace(/:/g, "") + "00"; // HHMMSS

    const dtStart = `${cleanDate}T${startHourMin}`;
    const dtEnd = `${cleanDate}T${endHourMin}`;
    const stamp = new Date(task.createdAt).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

    icsContent += [
      "BEGIN:VEVENT",
      `UID:${task.id}@dailyflow.ai`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=Asia/Jakarta:${dtStart}`,
      `DTEND;TZID=Asia/Jakarta:${dtEnd}`,
      `SUMMARY:${task.title}`,
      `DESCRIPTION:${task.notes || ""} [Kategori: ${task.routine.toUpperCase()}]`,
      "STATUS:CONFIRMED",
      "SEQUENCE:0",
      "END:VEVENT",
    ].join("\r\n") + "\r\n";
  });

  icsContent += "END:VCALENDAR";

  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `dailyflow_calendar_${tasks[0].date}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
