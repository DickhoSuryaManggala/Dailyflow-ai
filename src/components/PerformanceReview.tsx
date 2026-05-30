import React, { useState } from "react";
import { Award, BrainCircuit, Mail, Send, CheckCircle2, ShieldAlert, BookOpen, Loader2 } from "lucide-react";
import { MonthlyEvaluation } from "../types";

interface PerformanceReviewProps {
  userId: string;
  futureGoals: string;
  monthlyEvaluations: MonthlyEvaluation[];
  onSaveEvaluation: (evaluation: MonthlyEvaluation) => void;
  tasksCompletedCount: number;
  totalTasksCount: number;
  averageFocusTime: number;
}

export default function PerformanceReview({
  userId,
  futureGoals,
  monthlyEvaluations,
  onSaveEvaluation,
  tasksCompletedCount,
  totalTasksCount,
  averageFocusTime
}: PerformanceReviewProps) {
  const [loading, setLoading] = useState(false);
  const [submittingEmail, setSubmittingEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [monthString, setMonthString] = useState("Mei 2026");
  const [selectedEval, setSelectedEval] = useState<MonthlyEvaluation | null>(
    monthlyEvaluations.length > 0 ? monthlyEvaluations[monthlyEvaluations.length - 1] : null
  );

  const handleEvaluate = async () => {
    setLoading(true);
    setEmailStatus(null);
    try {
      const completionRate = totalTasksCount > 0 ? Math.round((tasksCompletedCount / totalTasksCount) * 100) : 0;
      
      const response = await fetch("/api/llm/evaluate-month", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthString,
          futureGoals,
          averageFocusTime,
          completionRate,
          analyticsSummary: {
            totalTasks: totalTasksCount,
            completedTasks: tasksCompletedCount,
            focusMinutes: averageFocusTime * 30, // simulated monthly focus minutes
          }
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Gagal melakukan evaluasi.");
      }

      const newEval: MonthlyEvaluation = {
        id: monthString.toLowerCase().replace(" ", "-"),
        userId,
        monthString,
        productivityScore: data.evaluation.productivityScore || 75,
        strengths: data.evaluation.strengths || ["Konsisten melakukan rutinitas utama"],
        weaknesses: data.evaluation.weaknesses || ["Ada jeda waktu luang berlebihan di siang hari"],
        recommendations: data.evaluation.recommendations || ["Pertahankan ketepatan waktu tidur."],
      };

      onSaveEvaluation(newEval);
      setSelectedEval(newEval);
    } catch (err: any) {
      alert("Kesalahan evaluasi AI: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setEmailStatus("Masukkan email yang valid.");
      return;
    }

    setSubmittingEmail(true);
    setEmailStatus(null);

    try {
      const response = await fetch("/api/send-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          reportType: "Bulanan",
          monthString,
          evaluationData: selectedEval,
          currentProgress: {
            tasksCompleted: tasksCompletedCount,
            totalTasks: totalTasksCount,
            focusMinutes: averageFocusTime * 30
          }
        }),
      });

      const data = await response.json();
      if (data.success) {
        setEmailStatus(`Laporan PDF otomatis berhasil dikirimkan ke: ${data.recipient}`);
      } else {
        throw new Error(data.error || "Gagal mengirim.");
      }
    } catch (err: any) {
      setEmailStatus(`Gagal mengirim: ${err.message}`);
    } finally {
      setSubmittingEmail(false);
    }
  };

  return (
    <div className="bg-zinc-900/20 border border-zinc-800/80 rounded-2xl p-4 sm:p-6 shadow-md transition-colors space-y-6">
      
      {/* Tab Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-900/80 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-950/40 text-purple-400 border border-purple-900/30 rounded-xl">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white font-sans">Evaluasi Performa & Insight AI</h2>
            <p className="text-xs text-zinc-400 font-sans mt-0.5">Analisis mendalam pencapaian bulanan Anda dipandu kecerdasan AI</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={monthString}
            onChange={(e) => setMonthString(e.target.value)}
            className="px-3.5 py-2 bg-zinc-950 text-xs font-bold rounded-xl text-zinc-300 border border-zinc-850 focus:outline-none focus:border-indigo-600 transition-colors cursor-pointer"
          >
            <option value="Mei 2026">Mei 2026</option>
            <option value="April 2026">April 2026</option>
            <option value="Maret 2026">Maret 2026</option>
          </select>

          <button
            onClick={handleEvaluate}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-750 disabled:bg-zinc-700 disabled:opacity-40 text-white font-extrabold text-xs rounded-xl shadow-sm cursor-pointer transition-all"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                Mengevaluasi...
              </>
            ) : (
              <>Minta Komentar AI Coach</>
            )}
          </button>
        </div>
      </div>

      {/* Main Evaluator UI */}
      {selectedEval ? (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Dial Graphic Box */}
          <div className="md:col-span-4 bg-zinc-950/35 rounded-xl p-4 sm:p-6 border border-zinc-911 flex flex-col items-center justify-center text-center shadow-inner">
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#10B981] mb-2">Skor Produktivitas</span>
            
            <div className="relative w-32 h-32 flex items-center justify-center mb-3">
              {/* SVG Ring Gauge */}
              <svg className="w-full h-full transform -rotate-95" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  strokeWidth="8"
                  stroke="#E2E8F0"
                  fill="transparent"
                  className="stroke-zinc-900"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  strokeWidth="8"
                  stroke="url(#purpleGrad)"
                  strokeDasharray="251.2"
                  strokeDashoffset={251.2 - (251.2 * selectedEval.productivityScore) / 100}
                  strokeLinecap="round"
                  fill="transparent"
                />
                <defs>
                  <linearGradient id="purpleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10B981" />
                    <stop offset="100%" stopColor="#4F46E5" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-3xl font-mono font-bold text-white leading-none">
                  {selectedEval.productivityScore}
                </span>
                <span className="text-[10px] text-zinc-500 font-sans mt-1 font-bold">Poin</span>
              </div>
            </div>

            <span className="text-xs font-extrabold text-emerald-400 mt-1 font-sans">
              {selectedEval.productivityScore >= 80 ? "🔥 Kinerja Luar Biasa!" : selectedEval.productivityScore >= 60 ? "🌱 Konsisten & Terjaga!" : "👀 Memerlukan Penyesuaian"}
            </span>
          </div>

          {/* Details Lists */}
          <div className="md:col-span-8 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-emerald-950/15 rounded-xl p-4 border border-emerald-900/30 shadow-inner">
                <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Kelebihan Anda
                </h4>
                <ul className="space-y-1.5 text-xs text-zinc-300 list-disc list-inside font-sans">
                  {selectedEval.strengths.map((str, idx) => (
                    <li key={idx} className="leading-relaxed">{str}</li>
                  ))}
                </ul>
              </div>

              <div className="bg-rose-950/15 rounded-xl p-4 border border-rose-900/30 shadow-inner">
                <h4 className="text-xs font-bold text-rose-400 flex items-center gap-1.5 mb-2">
                  <ShieldAlert className="w-4 h-4 text-[#F43F5E]" /> Hambatan / Titik Lemah
                </h4>
                <ul className="space-y-1.5 text-xs text-zinc-300 list-disc list-inside font-sans">
                  {selectedEval.weaknesses.map((weak, idx) => (
                    <li key={idx} className="leading-relaxed">{weak}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="bg-zinc-950/35 border border-zinc-900 rounded-xl p-4 shadow-inner">
              <h4 className="text-xs font-bold text-indigo-400 flex items-center gap-1.5 mb-2.5">
                <BookOpen className="w-4 h-4 text-indigo-400" /> Saran Tindakan Berkelanjutan
              </h4>
              <ul className="space-y-2 text-xs text-zinc-300 font-sans">
                {selectedEval.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span className="text-[#10B981] font-bold font-mono">#{idx+1}</span>
                    <span className="leading-relaxed">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 border border-dashed border-zinc-805 rounded-xl bg-zinc-950/10">
          <Award className="w-10 h-10 text-indigo-500 mx-auto mb-3 animate-pulse" />
          <h3 className="text-sm font-bold text-zinc-300">Evaluasi Belum Diminta</h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-md mx-auto">Klik tombol &ldquo;Minta Komentar AI Coach&rdquo; di kanan atas untuk menganalisis statistik kemajuan Anda.</p>
        </div>
      )}

      {/* Simulated automated emailing report form */}
      <div className="bg-zinc-950/15 border border-zinc-900 rounded-xl p-5 shadow-inner">
        <h3 className="text-xs font-bold text-zinc-200 flex items-center gap-1.5 mb-2">
          <Mail className="w-4 h-4 text-sky-400" /> Sistem Pelaporan Otomatis Email
        </h3>
        <p className="text-xs text-zinc-500 mb-4">Pengiriman laporan ringkasan berkala otomatis langsung ke inbox email Anda.</p>

        <form onSubmit={handleSendEmail} className="flex flex-col sm:flex-row gap-3 max-w-xl">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Masukkan email tujuan (contoh: anda@email.com)"
            className="flex-1 px-4 py-2.5 bg-zinc-950 border border-zinc-850 text-zinc-250 placeholder-zinc-700 text-xs rounded-xl focus:outline-none focus:border-indigo-600"
            required
          />
          <button
            type="submit"
            disabled={submittingEmail || !selectedEval}
            className="py-2.5 px-5 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border border-zinc-800 hover:text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 transition-colors"
          >
            {submittingEmail ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" /> Mengirim...
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" /> Kirim Laporan
              </>
            )}
          </button>
        </form>

        {!selectedEval && (
          <p className="text-[10px] text-rose-455 mt-2 font-bold font-sans">⚠️ Lakukan evaluasi AI Coach di atas terlebih dahulu untuk mengaktifkan berkas laporan email.</p>
        )}

        {emailStatus && (
          <div className="mt-3 p-3 bg-zinc-950 border border-zinc-900 text-[11px] text-zinc-350 rounded-lg max-w-xl leading-relaxed">
            <span className="font-semibold text-emerald-400 block mb-1">Status Pengiriman Layanan Cloud:</span>
            {emailStatus}
          </div>
        )}
      </div>
    </div>
  );
}
