import React, { useState, useEffect, useRef } from "react";
import { Play, Pause, RotateCcw, AlertCircle, Save, Trash2, LayoutList, History } from "lucide-react";
import { ActivityLog } from "../types";

interface ProductivityMonitorProps {
  activityLogs: ActivityLog[];
  onAddLog: (activityName: string, type: "focus" | "rest" | "distraction", duration: number) => void;
  onDeleteLog: (id: string) => void;
}

export default function ProductivityMonitor({ activityLogs, onAddLog, onDeleteLog }: ProductivityMonitorProps) {
  const [activityName, setActivityName] = useState("Sesi Belajar Mandiri");
  const [type, setType] = useState<"focus" | "rest" | "distraction">("focus");
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  
  // Ref for background interval
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Stats calculation
  const stats = activityLogs.reduce((acc, curr) => {
    if (curr.type === "focus") acc.focus += curr.durationMinutes;
    else if (curr.type === "rest") acc.rest += curr.durationMinutes;
    else if (curr.type === "distraction") acc.distraction += curr.durationMinutes;
    return acc;
  }, { focus: 0, rest: 0, distraction: 0 });

  const totalLogged = stats.focus + stats.rest + stats.distraction;

  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive]);

  const handleToggle = () => {
    setIsActive(!isActive);
  };

  const handleReset = () => {
    setIsActive(false);
    setSeconds(0);
  };

  const saveTimerSession = () => {
    const minutes = Math.max(1, Math.round(seconds / 60)); // minimum 1 minute
    onAddLog(activityName, type, minutes);
    setSeconds(0);
    setIsActive(false);
  };

  const handleSubmitManual = (e: React.FormEvent) => {
    e.preventDefault();
    const durationInput = (e.currentTarget.elements.namedItem("manual_minutes") as HTMLInputElement).value;
    const minutes = parseInt(durationInput, 10);
    if (!isNaN(minutes) && minutes > 0) {
      onAddLog(activityName, type, minutes);
      (e.currentTarget as HTMLFormElement).reset();
    }
  };

  const formatTime = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="bg-zinc-900/20 border border-zinc-800/80 rounded-2xl p-4 sm:p-6 shadow-md transition-colors">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 text-[#6366F1] border border-indigo-950/40 rounded-xl animate-pulse">
          <History className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-md font-bold text-white">Pelacak Kegiatan Produktivitas</h2>
          <p className="text-xs text-zinc-400 font-medium">Monitor waktu fokus, istirahat, dan distraksi Anda secara akurat</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Stopwatch Active Session Card */}
        <div className="lg:col-span-7 bg-zinc-950/35 border border-zinc-900 rounded-xl p-4 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span className="text-[10px] uppercase tracking-widest font-extrabold text-zinc-550">Sesi Pelacakan Aktif</span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-widest text-[#10B981] mb-1.5 leading-none">
                  Nama Kegiatan / Deskripsi Singkat
                </label>
                <input
                  type="text"
                  value={activityName}
                  onChange={(e) => setActivityName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-950 text-xs text-zinc-200 rounded-xl border border-zinc-805 focus:outline-none focus:border-indigo-500 placeholder-zinc-750"
                  placeholder="Ketik apa yang sedang Anda kerjakan..."
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold tracking-widest text-[#10B981] mb-1.5 leading-none">
                  Kategori Waktu
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setType("focus")}
                    className={`py-2 text-[11px] font-bold rounded-xl text-center border transition-all cursor-pointer ${
                      type === "focus"
                        ? "bg-purple-950/45 border-purple-800 text-purple-400 shadow-sm"
                        : "bg-zinc-950 border-zinc-855 text-zinc-500 hover:bg-zinc-900"
                    }`}
                  >
                    🎯 Fokus Kerja
                  </button>
                  <button
                    type="button"
                    onClick={() => setType("rest")}
                    className={`py-2 text-[11px] font-bold rounded-xl text-center border transition-all cursor-pointer ${
                      type === "rest"
                        ? "bg-emerald-950/45 border-emerald-800 text-emerald-400 shadow-sm"
                        : "bg-zinc-950 border-zinc-855 text-zinc-500 hover:bg-zinc-900"
                    }`}
                  >
                    🍃 Istirahat
                  </button>
                  <button
                    type="button"
                    onClick={() => setType("distraction")}
                    className={`py-2 text-[11px] font-bold rounded-xl text-center border transition-all cursor-pointer ${
                      type === "distraction"
                        ? "bg-rose-950/45 border-rose-800 text-rose-400 shadow-sm"
                        : "bg-zinc-950 border-zinc-855 text-zinc-500 hover:bg-zinc-900"
                    }`}
                  >
                    ⚠️ Terdistraksi
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center my-6 py-4">
            <span className="text-4xl font-mono font-bold tracking-widest text-[#10B981]">
              {formatTime(seconds)}
            </span>
            <span className="text-[10px] text-zinc-550 mt-1 font-sans font-bold tracking-wider">HH:MM:SS</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleToggle}
              className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-extrabold text-xs tracking-wide shadow-sm cursor-pointer transition-colors ${
                isActive
                  ? "bg-amber-500 hover:bg-amber-600 text-black"
                  : "bg-indigo-600 hover:bg-indigo-750 text-white"
              }`}
            >
              {isActive ? (
                <>
                  <Pause className="w-4 h-4 stroke-[2.5]" /> Pause Sesi
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 stroke-[2.5]" /> Mulai Sesi Aktif
                </>
              )}
            </button>

            <button
              onClick={handleReset}
              className="p-3 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-xl cursor-pointer"
              title="Reset Timer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={saveTimerSession}
              disabled={seconds < 5}
              className="px-4 py-3 bg-emerald-500 disabled:opacity-40 hover:bg-emerald-600 text-black font-extrabold text-xs rounded-xl cursor-pointer transition-colors"
              title="Simpan Log Waktu"
            >
              <Save className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Input Manual, Visualization summary list logs */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-zinc-950/35 border border-zinc-911 rounded-xl p-4">
            <h3 className="text-xs font-bold text-zinc-250 mb-2.5 flex items-center gap-1.5 font-sans">
              📌 Input Waktu Log Manual
            </h3>
            <form onSubmit={handleSubmitManual} className="flex gap-2.5">
              <input
                type="number"
                name="manual_minutes"
                min="1"
                placeholder="Durasi (Menit)"
                className="w-24 px-3 py-2 bg-zinc-950 border border-zinc-850 text-zinc-250 placeholder-zinc-700 text-xs rounded-xl focus:outline-none focus:border-indigo-500"
                required
              />
              <button
                type="submit"
                className="flex-1 py-2 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-850 text-xs font-bold leading-none rounded-xl transition-all shadow-sm cursor-pointer"
              >
                Log Manual
              </button>
            </form>
          </div>

          <div className="bg-zinc-950/35 border border-zinc-911 rounded-xl p-4">
            <h3 className="text-xs font-bold text-zinc-250 mb-3 flex items-center gap-1.5 font-sans">
              📊 Distribusi Alokasi Waktu
            </h3>

            <div className="space-y-3.5 text-xs">
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-purple-400 font-medium font-sans">🎯 Jam Kerja (Fokus)</span>
                  <span className="font-semibold text-zinc-300">{stats.focus} menit</span>
                </div>
                <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-purple-500 h-full"
                    style={{ width: `${totalLogged ? (stats.focus / totalLogged) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-emerald-400 font-medium">🍃 Jam Istirahat</span>
                  <span className="font-semibold text-zinc-300">{stats.rest} menit</span>
                </div>
                <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full"
                    style={{ width: `${totalLogged ? (stats.rest / totalLogged) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-rose-455 font-medium">⚠️ Jam Distraksi</span>
                  <span className="font-semibold text-zinc-300">{stats.distraction} menit</span>
                </div>
                <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-rose-500 h-full"
                    style={{ width: `${totalLogged ? (stats.distraction / totalLogged) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* History logs today */}
      <div className="mt-6 border-t border-zinc-905 pt-5">
        <h3 className="text-xs font-bold text-zinc-200 mb-3 flex items-center gap-1.5">
          <LayoutList className="w-4 h-4 text-indigo-400" /> Riwayat Pelacakan Aktivitas Hari Ini
        </h3>

        {activityLogs.length === 0 ? (
          <div className="text-center py-6 border border-dashed border-zinc-805 rounded-xl bg-zinc-950/10">
            <span className="text-xs text-zinc-500">Belum ada aktivitas yang direkam untuk hari ini. Mulai pencatat waktu di atas!</span>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-56 overflow-y-auto">
            {activityLogs.slice().reverse().map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between p-3.5 bg-zinc-950 border border-zinc-850 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <span className={`w-3 h-3 rounded-full ${
                    log.type === "focus" ? "bg-purple-500" : log.type === "rest" ? "bg-emerald-500" : "bg-rose-500"
                  }`} />
                  <div>
                    <h4 className="text-xs font-bold text-zinc-150">{log.activityName}</h4>
                    <span className="text-[10px] text-zinc-500 block font-medium mt-0.5">
                      {new Date(log.timestamp).toLocaleTimeString("id", { hour: "2-digit", minute: "2-digit" })} • {
                        log.type === "focus" ? "Fokus Kerja" : log.type === "rest" ? "Istirahat" : "Terdistraksi"
                      }
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-extrabold text-zinc-300 font-mono">{log.durationMinutes} m</span>
                  <button
                    onClick={() => onDeleteLog(log.id)}
                    className="p-1 text-zinc-650 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                    title="Hapus Log"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
