import React, { useState, useMemo } from "react";
import { Sparkles, BarChart3, Target, Flame, Hourglass, HelpCircle, Loader2 } from "lucide-react";
import { spawnNotification } from "../utils/notifications";
import { getLocalTasks, getLocalLogs } from "../utils/storage";

interface WeeklyDashboardProps {
  userId: string;
  futureGoals: string;
  completedTasksCount: number;
  totalTasksCount: number;
  totalFocusMinutes: number;
  totalRestMinutes: number;
  totalDistractionMinutes: number;
  motivationQuote: string;
  onUpdateMotivation: (newQuote: string) => void;
  selectedDate: string;
}

export default function WeeklyDashboard({
  userId,
  futureGoals,
  completedTasksCount,
  totalTasksCount,
  totalFocusMinutes,
  totalRestMinutes,
  totalDistractionMinutes,
  motivationQuote,
  onUpdateMotivation,
  selectedDate
}: WeeklyDashboardProps) {
  const [loading, setLoading] = useState(false);

  // Completion calculation for the selected date
  const efficiencyRate = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  // Calculate real metrics for the 7 days of the week containing selectedDate
  const weekdaysData = useMemo(() => {
    const parts = selectedDate.split("-");
    let baseDate = new Date();
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      baseDate = new Date(year, month, day);
    } else {
      baseDate = new Date(selectedDate);
    }

    if (isNaN(baseDate.getTime())) {
      baseDate = new Date();
    }

    // Get Monday of that week
    const currentDay = baseDate.getDay();
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(baseDate);
    monday.setDate(baseDate.getDate() + distanceToMonday);

    const names = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
    const allLocalTasks = getLocalTasks();
    const allLocalLogs = getLocalLogs();
    const activeUID = userId || "local-user";

    const days = [];
    for (let i = 0; i < 7; i++) {
      const tempDate = new Date(monday);
      tempDate.setDate(monday.getDate() + i);
      
      const yStr = tempDate.getFullYear();
      const mStr = String(tempDate.getMonth() + 1).padStart(2, "0");
      const dStr = String(tempDate.getDate()).padStart(2, "0");
      const dateKey = `${yStr}-${mStr}-${dStr}`;

      // Filter tasks for this date and user
      const dailyTasks = allLocalTasks.filter(
        t => (t.userId === activeUID || t.userId === "local-user") && t.date === dateKey
      );
      const totalDaily = dailyTasks.length;
      const completedDaily = dailyTasks.filter(t => t.completed).length;
      const dailyProgress = totalDaily > 0 ? Math.round((completedDaily / totalDaily) * 100) : 0;

      // Filter focus logs for this date and user
      const dailyLogs = allLocalLogs.filter(
        l => (l.userId === activeUID || l.userId === "local-user") && l.date === dateKey && l.type === "focus"
      );
      const dailyFocus = dailyLogs.reduce((sum, curr) => sum + curr.durationMinutes, 0);

      days.push({
        name: names[i],
        progress: dailyProgress,
        focus: dailyFocus,
        label: `${dailyProgress}%`
      });
    }

    return days;
  }, [selectedDate, userId, completedTasksCount, totalTasksCount, totalFocusMinutes]);

  const handleRequestMotivation = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/llm/motivation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          futureGoals,
          completedTasks: completedTasksCount,
          totalTasks: totalTasksCount,
          focusMinutes: totalFocusMinutes
        }),
      });

      const data = await response.json();
      if (data.success && data.motivation) {
        onUpdateMotivation(data.motivation);
        spawnNotification("🌱 Motivasi Harian Utama Pas", "Motivasi harian personal berhasil diproses dari AI Coach.", "info");
      } else {
        throw new Error("Motivation content response missing.");
      }
    } catch (err: any) {
      onUpdateMotivation(`🏆 Tetap fokus, karena setiap langkah kecil hari ini membawa kamu lebih dekat ke tujuan.`);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestRoast = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/llm/roast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          futureGoals,
          completedTasks: completedTasksCount,
          totalTasks: totalTasksCount,
          focusMinutes: totalFocusMinutes,
          distractionMinutes: totalDistractionMinutes
        }),
      });

      const data = await response.json();
      if (data.success && data.roast) {
        onUpdateMotivation(data.roast);
        spawnNotification("🔥 Sentilan AI Roaster", data.roast, "alert");
      } else {
        throw new Error("Roast response is missing.");
      }
    } catch (err: any) {
      const fallbackRoast = `Cita-citamu: "${futureGoals || "Sukses mulia"}". Realitas hari ini: Selesai ${completedTasksCount}/${totalTasksCount} tugas. Jangan cuma ngimpi setinggi langit kalau aksi masih sekelas rebahan di bumi!`;
      onUpdateMotivation(fallbackRoast);
      spawnNotification("🔥 Sentilan AI Roaster", fallbackRoast, "alert");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Key-Value Quick Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        <div className="bg-zinc-900/20 border border-zinc-800/80 rounded-xl p-4.5 shadow-md flex items-center gap-3 transition-all">
          <div className="p-2.5 bg-sky-950/20 text-sky-400 border border-sky-900/30 rounded-xl">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-zinc-450 font-bold uppercase tracking-widest block">Efisiensi Jadwal</span>
            <span className="text-xl font-mono font-bold text-white">{efficiencyRate}%</span>
          </div>
        </div>

        <div className="bg-zinc-900/20 border border-zinc-800/80 rounded-xl p-4.5 shadow-md flex items-center gap-3 transition-colors">
          <div className="p-2.5 bg-emerald-950/20 text-emerald-400 border border-emerald-900/30 rounded-xl">
            <Flame className="w-5 h-5 animate-bounce" />
          </div>
          <div>
            <span className="text-[10px] text-zinc-455 font-bold uppercase tracking-widest block">Tugas Selesai</span>
            <span className="text-xl font-mono font-bold text-white">
              {completedTasksCount} <span className="text-xs text-zinc-500 font-sans font-normal">/ {totalTasksCount}</span>
            </span>
          </div>
        </div>

        <div className="bg-zinc-900/20 border border-zinc-800/80 rounded-xl p-4.5 shadow-md flex items-center gap-3 transition-colors">
          <div className="p-2.5 bg-purple-950/20 text-purple-400 border border-purple-900/30 rounded-xl">
            <Hourglass className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-zinc-455 font-bold uppercase tracking-widest block">Waktu Fokus</span>
            <span className="text-xl font-mono font-bold text-white">{totalFocusMinutes} <span className="text-xs text-zinc-500 font-sans font-normal">m</span></span>
          </div>
        </div>

        <div className="bg-zinc-900/20 border border-zinc-800/80 rounded-xl p-4.5 shadow-md flex items-center gap-3 transition-colors">
          <div className="p-2.5 bg-rose-950/20 text-rose-400 border border-rose-900/30 rounded-xl">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-zinc-455 font-bold uppercase tracking-widest block">Waktu Terganggu</span>
            <span className="text-xl font-mono font-bold text-white">{totalDistractionMinutes} <span className="text-xs text-zinc-500 font-sans font-normal">m</span></span>
          </div>
        </div>

      </div>

      {/* Grid: Charts + AI quote */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Weekly Completion Progress Graphic (SVG Column chart) */}
        <div className="lg:col-span-7 bg-zinc-900/20 border border-zinc-800/80 rounded-2xl p-4 sm:p-6 shadow-md transition-colors flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4.5 h-4.5 text-indigo-400" />
              <h3 className="text-sm font-bold text-white font-sans">Statistik Kemajuan Mingguan</h3>
            </div>
            <p className="text-xs text-zinc-400 mb-6">Visualisasi tingkat penyelesaian rencana harian selama 7 hari terakhir.</p>
          </div>

          {/* SVG Custom Responsive Columns */}
          <div className="overflow-x-auto pb-2 scrollbar-none">
            <div className="flex items-end justify-between h-41 pt-6 pb-2 border-b border-zinc-900 min-w-[340px] md:min-w-0 md:px-3">
              {weekdaysData.map((day, idx) => (
                <div key={idx} className="flex flex-col items-center flex-1 group">
                  {/* Column details tooltip */}
                  <span className="text-[9px] font-mono font-bold bg-[#10B981] text-black px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity mb-2">
                    {day.focus}m fokus
                  </span>
                  
                  {/* Visual Bar container */}
                  <div className="w-8 bg-zinc-950 border border-zinc-850 rounded-lg h-24 flex items-end overflow-hidden">
                    <div
                      className="w-full bg-gradient-to-t from-emerald-500 to-indigo-600 rounded-b px-0.5 group-hover:from-emerald-400 transition-all duration-500"
                      style={{ height: `${day.progress}%` }}
                    />
                  </div>

                  <span className="text-[10px] font-bold text-zinc-300 mt-2">{day.name}</span>
                  <span className="text-[9px] text-zinc-550 font-mono mt-0.5 font-bold">{day.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* AI Personalized Motivation Block */}
        <div className="lg:col-span-5 bg-gradient-to-br from-indigo-950/30 via-zinc-950/50 to-rose-950/20 border border-zinc-800/80 rounded-2xl p-4 sm:p-6 shadow-md flex flex-col justify-between text-white relative overflow-hidden">
          
          {/* Accent decoration rings */}
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-rose-500/15 rounded-full blur-2xl pointer-events-none animate-pulse" />
          <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="relative space-y-4">
            <div className="border-b border-zinc-900 pb-3 flex flex-col gap-2.5">
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#10B981] flex items-center gap-1 font-sans">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-spin-slow" /> AI Coach & Roaster Center
              </span>
              
              {/* Dual button selector for personalized feedback style */}
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  onClick={handleRequestMotivation}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-1 bg-zinc-900/80 border border-zinc-800 hover:border-emerald-600/40 hover:bg-emerald-950/10 text-white font-extrabold text-[10px] tracking-wide py-2 px-2.5 rounded-xl transition-all cursor-pointer disabled:opacity-40"
                  title="Dapatkan kata motivasi penuh kehangatan & inspirasi"
                >
                  🌱 Motivasi Hangat
                </button>
                <button
                  onClick={handleRequestRoast}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-1 bg-zinc-900/80 border border-zinc-800 hover:border-rose-600/40 hover:bg-rose-950/25 text-white font-extrabold text-[10px] tracking-wide py-2 px-2.5 rounded-xl transition-all cursor-pointer disabled:opacity-40"
                  title="Dapatkan kritik roasting pedas, kocak & mendidik mental"
                >
                  🔥 Roasting Pedas
                </button>
              </div>
            </div>

            {/* Displaying Current AI Message */}
            <div className="mt-4 min-h-24 bg-zinc-950/40 border border-zinc-900/65 rounded-xl p-3.5">
              <div className="flex items-center gap-1.5 mb-2">
                <span className={`w-1.5 h-1.5 rounded-full ${motivationQuote.includes("Sandi") || motivationQuote.includes("Jalur") || motivationQuote.includes("rebahan") || motivationQuote.includes("giveaway") || motivationQuote.includes("ngimpi") ? "bg-rose-500 animate-ping" : "bg-emerald-400 animate-pulse"}`} />
                <span className="text-[9px] uppercase tracking-wider font-bold text-zinc-500">
                  {motivationQuote.includes("Sandi") || motivationQuote.includes("Jalur") || motivationQuote.includes("rebahan") || motivationQuote.includes("giveaway") || motivationQuote.includes("ngimpi") ? "Sentilan AI Roaster 🔥" : "Motivasi Hangat AI Coach 🌱"}
                </span>
              </div>
              <p className="text-xs italic leading-relaxed text-zinc-200 font-sans font-medium">
                &ldquo;{motivationQuote || "Sentuh tombol di atas untuk mendapatkan motivasi harian atau roasting pedas lucu dari AI sesuai pencapaianmu!"}&rdquo;
              </p>
            </div>
          </div>

          <div className="border-t border-zinc-900 pt-4 mt-6">
            <span className="text-[9px] text-[#10B981] block font-bold uppercase tracking-widest mb-1 leading-none">Target Impian Anda</span>
            <p className="text-xs text-zinc-100 font-bold font-sans truncate">{futureGoals || "Menjadi pribadi berdisiplin tinggi."}</p>
          </div>

        </div>

      </div>
    </div>
  );
}
