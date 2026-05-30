import React, { useState, useRef, useEffect } from "react";
import { Sparkles, Clock, Loader2, Send, MessageSquare, Bot, User, RefreshCw, Check } from "lucide-react";
import { Task } from "../types";

interface Message {
  sender: "ai" | "user";
  text: string;
}

interface AIPersonalizerProps {
  onScheduleGenerated: (tasks: Omit<Task, "id" | "userId" | "completed" | "createdAt" | "updatedAt" | "date">[]) => void;
  futureGoals: string;
  setFutureGoals: (val: string) => void;
  selectedDate: string;
  onCollegeDaysChange?: (days: string[]) => void;
  key?: string | number;
}

export default function AIPersonalizer({ onScheduleGenerated, futureGoals, setFutureGoals, selectedDate, onCollegeDaysChange }: AIPersonalizerProps) {
  const [profession, setProfession] = useState(() => localStorage.getItem("ai_profile_profession") || "Programmer / Kreator Konten");
  const [schoolSchedule, setSchoolSchedule] = useState(() => localStorage.getItem("ai_profile_schoolSchedule") || "Kuliah putus-nyambung dengan jeda kosong");
  const [jobType, setJobType] = useState(() => localStorage.getItem("ai_profile_jobType") || "Proyek freelance fleksibel");
  const [adHocHandling, setAdHocHandling] = useState(() => localStorage.getItem("ai_profile_adHocHandling") || "Sediakan blok waktu 'Buffer/Jadwal Dadakan' 1 jam sebelum tidur");
  const [wakeTime, setWakeTime] = useState(() => localStorage.getItem("ai_profile_wakeTime") || "06:00");
  const [sleepTime, setSleepTime] = useState(() => localStorage.getItem("ai_profile_sleepTime") || "22:30");
  const [activityPref, setActivityPref] = useState(() => localStorage.getItem("ai_profile_activityPref") || "Fokus tingkat tinggi di pagi hari, olahraga sore hari");
  
  // Persist Profile parameters whenever they change
  useEffect(() => {
    localStorage.setItem("ai_profile_profession", profession);
  }, [profession]);

  useEffect(() => {
    localStorage.setItem("ai_profile_schoolSchedule", schoolSchedule);
  }, [schoolSchedule]);

  useEffect(() => {
    localStorage.setItem("ai_profile_jobType", jobType);
  }, [jobType]);

  useEffect(() => {
    localStorage.setItem("ai_profile_adHocHandling", adHocHandling);
  }, [adHocHandling]);

  useEffect(() => {
    localStorage.setItem("ai_profile_wakeTime", wakeTime);
  }, [wakeTime]);

  useEffect(() => {
    localStorage.setItem("ai_profile_sleepTime", sleepTime);
  }, [sleepTime]);

  useEffect(() => {
    localStorage.setItem("ai_profile_activityPref", activityPref);
  }, [activityPref]);

  // Custom interactive student scheduler states
  const [selectedDays, setSelectedDays] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("student-college-days");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [studentSubStep, setStudentSubStep] = useState<"select_days" | "fill_schedule" | null>(null);
  const [quickPasteText, setQuickPasteText] = useState("");
  const [daySchedules, setDaySchedules] = useState<{ [key: string]: string }>(() => {
    try {
      const saved = localStorage.getItem("student-day-schedules");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const daysOfWeek = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

  // Sync selectedDays with localStorage and bubble up changes
  useEffect(() => {
    localStorage.setItem("student-college-days", JSON.stringify(selectedDays));
    if (onCollegeDaysChange) {
      onCollegeDaysChange(selectedDays);
    }
  }, [selectedDays, onCollegeDaysChange]);

  // Sync daySchedules with localStorage
  useEffect(() => {
    localStorage.setItem("student-day-schedules", JSON.stringify(daySchedules));
  }, [daySchedules]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedTasks, setGeneratedTasks] = useState<any[]>([]);

  const [isSaved, setIsSaved] = useState(false);

  // Q&A Chat State
  const [step, setStep] = useState(() => {
    const saved = localStorage.getItem("ai_profile_step");
    return saved ? parseInt(saved, 10) : 0;
  });
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem("ai_profile_messages");
      return saved ? JSON.parse(saved) : [
        {
          sender: "ai",
          text: "Halo! Saya AI Coach Anda. Mari kita rancang rancangan agenda harian terbaik yang produktif & seimbang khusus untuk Anda.\n\nPertama, apa Target Masa Depan atau Cita-cita utama yang ingin Anda capai saat ini?"
        }
      ];
    } catch {
      return [
        {
          sender: "ai",
          text: "Halo! Saya AI Coach Anda. Mari kita rancang rancangan agenda harian terbaik yang produktif & seimbang khusus untuk Anda.\n\nPertama, apa Target Masa Depan atau Cita-cita utama yang ingin Anda capai saat ini?"
        }
      ];
    }
  });

  // Sync step and messages to localStorage
  useEffect(() => {
    localStorage.setItem("ai_profile_step", step.toString());
  }, [step]);

  useEffect(() => {
    localStorage.setItem("ai_profile_messages", JSON.stringify(messages));
  }, [messages]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to lowest chat message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, step]);

  const handleSend = (text: string) => {
    if (!text.trim()) return;

    // 1. Add User response bubble
    const userMsg: Message = { sender: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");

    // 2. State machine based on current step
    if (step === 0) {
      setFutureGoals(text);
      setTimeout(() => {
        setStep(1);
        setMessages((prev) => [
          ...prev,
          {
            sender: "ai",
            text: `Rencana masa depan yang mulia: "${text}".\n\nSekarang, apa profesi atau peran Anda saat ini? Ini membantu saya menentukan tingkat kesibukan.`
          }
        ]);
      }, 550);
    } else if (step === 1) {
      setProfession(text);
      const isStudent = text.toLowerCase().includes("mahasiswa") || text.toLowerCase().includes("pelajar");
      setTimeout(() => {
        setStep(2);
        if (isStudent) {
          setStudentSubStep("select_days");
        }
        setMessages((prev) => [
          ...prev,
          {
            sender: "ai",
            text: isStudent
              ? `Sip! Kegiatan sebagai "${text}" terekam.\n\nPilih hari kuliah Anda dari Senin sampai Sabtu. Setelah memilih, Anda akan diminta memasukkan jumlah matkul dan jadwal untuk setiap hari secara berurutan. Jika ada hari tanpa kuliah, cukup jawab "Tidak ada kuliah".`
              : `Sip! Kegiatan sebagai "${text}" terekam.\n\nJika Anda masih sekolah atau kuliah, jam berapa kegiatannya biasanya berlangsung? Apakah jadwalnya teratur atau 'putus-nyambung' (selang-seling)?\n\nCeritakan secara detail di sini agar kita bisa merancang strategi pemanfaatan waktu jeda/kosong yang paling efisien.`
          }
        ]);
      }, 550);
    } else if (step === 2) {
      setSchoolSchedule(text);
      setTimeout(() => {
        setStep(3);
        setMessages((prev) => [
          ...prev,
          {
            sender: "ai",
            text: `Tercatat dengan baik: "${text}". Agar waktu jeda kuliah Anda produktif atau istirahat Anda berkualitas, saya akan mengaturnya.\n\nBerikutnya, bagaimana dengan pekerjaan? Apakah Anda memiliki pekerjaan sampingan, mengurus proyek freelance, atau punya bisnis sendiri? Silakan jelaskan status & tingkat kesibukannya.`
          }
        ]);
      }, 550);
    } else if (step === 3) {
      setJobType(text);
      setTimeout(() => {
        setStep(4);
        setMessages((prev) => [
          ...prev,
          {
            sender: "ai",
            text: `Pekerjaan/Freelance terekam: "${text}". Menuntut fokus yang seimbang!\n\nSelanjutnya, bagaimana cara Anda ingin menghadapi tugas dadakan, revisi mendadak, atau target deadline yang tiba-tiba muncul di luar dugaan? Apakah Anda memerlukan celah waktu "Sesi Buffer/Penyelamat Deadline" khusus sekitar 1 jam untuk berjaga-jaga di penghujung hari?`
          }
        ]);
      }, 550);
    } else if (step === 4) {
      setAdHocHandling(text);
      setTimeout(() => {
        setStep(5);
        setMessages((prev) => [
          ...prev,
          {
            sender: "ai",
            text: `Taktik hebat! Mengantisipasi ketidakpastian adalah langkah cerdas orang sukses.\n\nBerikutnya, pukul berapa Anda biasanya bangun tidur pagi untuk menyinari hari?`
          }
        ]);
      }, 550);
    } else if (step === 5) {
      setWakeTime(text);
      setTimeout(() => {
        setStep(6);
        setMessages((prev) => [
          ...prev,
          {
            sender: "ai",
            text: `Bangun tidur pukul ${text} pagi siap beraktivitas.\n\nDan pukul berapa Anda biasanya menargetkan tidur malam untuk memulihkan energi penuh?`
          }
        ]);
      }, 550);
    } else if (step === 6) {
      setSleepTime(text);
      setTimeout(() => {
        setStep(7);
        setMessages((prev) => [
          ...prev,
          {
            sender: "ai",
            text: `Pukul ${text} malam adalah waktu istirahat utama.\n\nTerakhir, bagaimana preferensi gaya atau ritme harian yang Anda inginkan? (Bebas kustomisasi!)`
          }
        ]);
      }, 550);
    } else if (step === 7) {
      setActivityPref(text);
      setTimeout(() => {
        setStep(8);
        setMessages((prev) => [
          ...prev,
          {
            sender: "ai",
            text: `Terima kasih atas jawaban Anda! Seluruh rancangan data profile harian Anda telah lengkap.\n\nSaya telah mengintegrasikan jam studi/kuliah Anda, komitmen pekerjaan/freelance, serta taktik buffer deadline ke profil perencanaan.\n\nSilakan klik tombol "Rancang Agenda Cerdas AI" di bawah!`
          }
        ]);
      }, 550);
    }
  };

  const handleFinishedSelectingDays = () => {
    if (selectedDays.length === 0) {
      alert("Silakan pilih minimal satu hari kuliah.");
      return;
    }
    setStudentSubStep("fill_schedule");
  };

  const handleQuickImport = () => {
    if (!quickPasteText.trim()) return;
    const lines = quickPasteText.split("\n");
    const updatedSchedules = { ...daySchedules };
    const detectedDays: string[] = [...selectedDays];
    
    lines.forEach((line) => {
      for (const day of daysOfWeek) {
        if (line.toLowerCase().includes(day.toLowerCase())) {
          let content = line;
          const colonIndex = line.indexOf(":");
          if (colonIndex !== -1) {
            content = line.substring(colonIndex + 1).trim();
          } else {
            content = line.replace(new RegExp(day, "gi"), "").trim();
            content = content.replace(/^[\s\-\:]+/, "").trim();
          }
          
          if (content) {
            updatedSchedules[day] = content;
            if (!detectedDays.includes(day)) {
              detectedDays.push(day);
            }
          }
        }
      }
    });
    
    setSelectedDays(detectedDays);
    setDaySchedules(updatedSchedules);
  };

  const handleSaveStudentSchedule = () => {
    const scheduleParts: string[] = [];
    selectedDays.forEach((day) => {
      const sch = daySchedules[day]?.trim();
      if (sch) {
        scheduleParts.push(`${day}: ${sch}`);
      } else {
        scheduleParts.push(`${day}: Tidak ada kuliah`);
      }
    });

    if (scheduleParts.length === 0) {
      alert("Silakan isi jadwal kuliah minimal satu hari atau gunakan impor cepat.");
      return;
    }

    const finalMessageText = `Jadwal Kuliah Mingguan saya:\n` + scheduleParts.join("\n");
    setStudentSubStep(null);
    handleSend(finalMessageText);
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setGeneratedTasks([]);
    setIsSaved(false);

    try {
      const response = await fetch("/api/llm/generate-tasks", {
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
          selectedDate
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Gagal menghasilkan jadwal harian otomatis.");
      }

      setGeneratedTasks(data.tasks);
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan sambungan server AI.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSchedule = () => {
    if (generatedTasks.length === 0) return;
    onScheduleGenerated(generatedTasks);
    setIsSaved(true);
  };

  // Reset chat flow to start over
  const resetChat = () => {
    setStep(0);
    setInputValue("");
    setGeneratedTasks([]);
    setIsSaved(false);
    setError(null);
    setSelectedDays([]);
    setStudentSubStep(null);
    setQuickPasteText("");
    setDaySchedules({});
    setMessages([
      {
        sender: "ai",
        text: "Halo! Saya AI Coach Anda. Mari kita rancang rancangan agenda harian terbaik yang produktif & seimbang khusus untuk Anda.\n\nPertama, apa Target Masa Depan atau Cita-cita utama yang ingin Anda capai saat ini?"
      }
    ]);
  };

  // Get helpful suggestion chips for quick answering
  const getSuggestions = () => {
    switch (step) {
      case 0:
        return [
          "Sukses merilis cerita komik secara konsisten",
          "Menjadi programmer kompeten & sukses",
          "Membangun rintisan startup teknologi mandiri",
          "Menjaga konsistensi belajar harian disiplin"
        ];
      case 1:
        return [
          "Mahasiswa & Kreator Konten Alur Cerita Komik",
          "Mahasiswa / Pelajar",
          "Programmer / Developer",
          "Kreator Konten",
          "Pekerja Lepas (Freelancer)"
        ];
      case 2:
        return [
          "Kuliah putus-nyambung (08:00 - 10:00 & 13:00 - 15:00)",
          "Sekolah teratur pagi-sore (07:30 - 15:00)",
          "Tidak ada sekolah/kuliah lagi"
        ];
      case 3:
        return [
          "Mengerjakan alur cerita & ilustrasi komik (butuh 2-4 jam)",
          "Ada proyek freelance fleksibel (butuh 2-3 jam)",
          "Bekerja paruh waktu sore/malam hari",
          "Tidak bekerja (fokus belajar penuh saja)"
        ];
      case 4:
        return [
          "Sediakan blok khusus 'Buffer/Jadwal Dadakan' 1 hour/hari",
          "Prioritaskan tugas deadline di sore hari setelah aktivitas utama",
          "Tingkatkan efisiensi jeda tanpa buffer khusus"
        ];
      case 5:
        return ["05:00", "06:00", "07:00"];
      case 6:
        return ["21:30", "22:30", "23:30"];
      case 7:
        return [
          "Fokus tinggi di pagi hari, olahraga sore hari",
          "Istirahat teratur siang hari, aktif fokus malam",
          "Banyak jeda santai untuk menjaga stamina"
        ];
      default:
        return [];
    }
  };

  return (
    <div className="bg-zinc-900/20 border border-zinc-800/80 rounded-2xl p-4 sm:p-6 shadow-md mb-6 transition-colors font-sans">
      
      {/* Dynamic Conversational Title Info */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-4 mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-emerald-450" />
          <h2 className="text-xs font-bold text-zinc-100 uppercase tracking-widest">
            AI Planner Chat Tanya Jawab
          </h2>
        </div>
        
        {step > 0 && (
          <button
            onClick={resetChat}
            className="flex items-center gap-1.2 text-[10px] text-zinc-550 hover:text-zinc-300 transition-colors pointer-events-auto cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            Ulangi Dari Awal
          </button>
        )}
      </div>

      {/* Chat Container Viewport */}
      <div className="flex flex-col space-y-4 max-h-80 overflow-y-auto p-4 mb-4 bg-zinc-950/45 border border-zinc-900 rounded-xl scrollbar-thin">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex items-start gap-2.5 max-w-[85%] ${
              m.sender === "user" ? "self-end flex-row-reverse" : "self-start"
            }`}
          >
            {/* Avatar Badge */}
            <div className={`p-1.5 rounded-lg flex-shrink-0 border ${
              m.sender === "user" 
                ? "bg-emerald-950/20 text-emerald-400 border-emerald-900/30" 
                : "bg-zinc-900 text-zinc-400 border-zinc-800"
            }`}>
              {m.sender === "user" ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5 text-emerald-400" />}
            </div>

            {/* Bubble Bubble */}
            <div className={`rounded-xl px-4 py-3 text-xs leading-relaxed ${
              m.sender === "user"
                ? "bg-emerald-500/15 border border-emerald-900/35 text-emerald-300 rounded-tr-none"
                : "bg-zinc-900 border border-zinc-850 text-zinc-300 rounded-tl-none whitespace-pre-wrap"
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Chat Keyboard & Suggestion Center */}
      {step < 8 ? (
        <div className="space-y-3">
          {step === 2 && (profession.toLowerCase().includes("mahasiswa") || profession.toLowerCase().includes("pelajar")) && studentSubStep !== null ? (
            /* Custom Interactive Student Scheduler Wizard */
            <div className="bg-zinc-950 border border-zinc-850/80 p-5 rounded-2xl space-y-5">
              {studentSubStep === "select_days" ? (
                /* Sub-step 1: Day selection */
                <div className="space-y-4 font-sans">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold tracking-widest text-[#10B981] uppercase">Rencana Kuliah</span>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      Pilih hari kuliah Anda dari Senin sampai Sabtu. Setelah memilih, tekan <strong className="text-emerald-400">"Selesai pilih hari"</strong> untuk masuk ke pengisian jadwal hari demi hari.
                    </p>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {daysOfWeek.map((day) => {
                      const isSelected = selectedDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedDays(prev => prev.filter(d => d !== day));
                            } else {
                              setSelectedDays(prev => [...prev, day]);
                            }
                          }}
                          className={`py-2 px-3 border rounded-xl text-xs font-extrabold transition-all cursor-pointer text-center ${
                            isSelected
                              ? "bg-emerald-500/15 border-[#10B981]/60 text-emerald-400"
                              : "bg-zinc-900 border-zinc-850 text-zinc-400 hover:bg-zinc-850 hover:text-zinc-200"
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-zinc-900">
                    <button
                      type="button"
                      onClick={handleFinishedSelectingDays}
                      className="px-5 py-2.5 bg-[#10B981] hover:bg-emerald-400 text-black font-extrabold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
                    >
                      Selesai pilih hari
                    </button>
                    <span className="text-[11px] text-zinc-550">
                      {selectedDays.length === 0 ? "Belum ada hari dipilih." : `Telah memilih ${selectedDays.length} hari: ${selectedDays.join(", ")}`}
                    </span>
                  </div>
                </div>
              ) : (
                /* Sub-step 2: Fill detailed schedule */
                <div className="space-y-5 font-sans">
                  {/* Info Box */}
                  <div className="bg-zinc-900/30 border border-zinc-900 p-4 rounded-xl">
                    <p className="text-xs text-zinc-400 leading-normal">
                      Isi jadwal kuliah untuk setiap hari yang Anda pilih. Anda dapat menempel seluruh jadwal sekaligus, lalu tekan <strong className="text-[#10B981]">"Impor jadwal cepat"</strong>.
                    </p>
                  </div>

                  {/* Quick paste loader */}
                  <div className="bg-zinc-900/10 border border-zinc-900/50 p-4 rounded-xl space-y-3">
                    <textarea
                      value={quickPasteText}
                      onChange={(e) => setQuickPasteText(e.target.value)}
                      rows={3}
                      className="w-full bg-zinc-950 border border-zinc-850 p-3 rounded-xl text-xs text-zinc-200 outline-none focus:border-emerald-500/60 transition-colors font-mono animate-none"
                      placeholder={`Contoh:
Senin: Matematika 08:00-09:30, Fisika 10:00-11:30
Selasa: Algoritma 09:00-11:00, Sistem Operasi 13:00-14:30`}
                    />
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-sans">
                      <button
                        type="button"
                        onClick={handleQuickImport}
                        className="px-4 py-2 bg-[#10B981] hover:bg-emerald-400 text-black font-extrabold text-[11px] rounded-xl shadow-sm transition-colors cursor-pointer"
                      >
                        Impor jadwal cepat
                      </button>
                      <span className="text-[10px] text-zinc-500">
                        Gunakan baris per hari: Senin, Selasa, Rabu, dl.
                      </span>
                    </div>
                  </div>

                  {/* Day items list */}
                  <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
                    {daysOfWeek.map((day) => {
                      const isSelected = selectedDays.includes(day);
                      const hasValue = !!daySchedules[day]?.trim();
                      return (
                        <div key={day} className={`space-y-1.5 p-3 rounded-xl border ${isSelected ? "bg-zinc-900/20 border-zinc-855" : "bg-zinc-950/20 border-zinc-900/40 opacity-50"}`}>
                          <div className="flex items-center justify-between font-sans">
                            <span className={`text-xs font-bold ${isSelected ? "text-white" : "text-zinc-500"}`}>
                              {day} {isSelected && <span className="text-[9px] bg-emerald-950/30 border border-emerald-900/40 text-emerald-400 px-1.5 py-0.2 rounded font-extrabold ml-1">TERPILIH</span>}
                            </span>
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${hasValue ? "text-emerald-450" : "text-zinc-650"}`}>
                              {hasValue ? "✓ Terisi" : "Belum diisi"}
                            </span>
                          </div>
                          <textarea
                            value={daySchedules[day] || ""}
                            onChange={(e) => setDaySchedules(prev => ({ ...prev, [day]: e.target.value }))}
                            rows={2}
                            placeholder="Contoh: 2 matkul - Matematika 08:00-09:30, Fisika 10:00-11:30"
                            className="w-full bg-zinc-950 border border-zinc-900 p-2.5 rounded-lg text-xs text-zinc-350 outline-none focus:border-zinc-850 transition-colors"
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Buttons */}
                  <div className="flex items-center gap-3 pt-3 border-t border-zinc-900">
                    <button
                      type="button"
                      onClick={() => setStudentSubStep("select_days")}
                      className="px-4 py-2 border border-zinc-850 text-zinc-400 hover:text-white bg-zinc-900 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                    >
                      Kembali ke Pilih Hari
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveStudentSchedule}
                      className="px-5 py-2.5 bg-[#10B981] hover:bg-emerald-400 active:bg-emerald-750 text-black font-extrabold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
                    >
                      Kirim Jadwal Kuliah
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Quick Suggestion Chips */}
              {getSuggestions().length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {getSuggestions().map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(s)}
                      className="px-3 py-1.5 bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-900 rounded-lg text-[10px] sm:text-xs transition-colors cursor-pointer"
                      type="button"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Form Typing Area */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend(inputValue);
                }}
                className="flex gap-2 items-center bg-zinc-950 border border-zinc-850 p-2 rounded-xl focus-within:border-emerald-500 transition-colors"
              >
                {/* Conditional input styles */}
                {step === 5 || step === 6 ? (
                  <input
                    type="time"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="flex-1 bg-transparent text-xs text-zinc-200 px-2 py-1.5 outline-none"
                    required
                  />
                ) : (
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Ketik jawaban Anda di sini..."
                    className="flex-1 bg-transparent text-xs text-zinc-250 px-2 py-1.5 outline-none placeholder-zinc-700 font-sans"
                    required
                  />
                )}
                
                <button
                  type="submit"
                  className="p-2.5 bg-[#10B981] hover:bg-emerald-600 active:bg-emerald-700 text-black rounded-lg transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </>
          )}
        </div>
      ) : (
        /* Final Action Module - Generate */
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <div className="bg-zinc-950/45 p-3 rounded-lg border border-zinc-900">
              <span className="text-[10px] text-zinc-500 block font-bold uppercase tracking-wide mb-1">Cita-Cita</span>
              <p className="text-xs text-zinc-200 font-bold truncate" title={futureGoals}>{futureGoals || "Menjadi pribadi berdisiplin"}</p>
            </div>
            <div className="bg-zinc-950/45 p-3 rounded-lg border border-zinc-900">
              <span className="text-[10px] text-zinc-500 block font-bold uppercase tracking-wide mb-1">Profesi</span>
              <p className="text-xs text-zinc-200 font-bold truncate" title={profession}>{profession}</p>
            </div>
            <div className="bg-zinc-950/45 p-3 rounded-lg border border-zinc-900">
              <span className="text-[10px] text-zinc-500 block font-bold uppercase tracking-wide mb-1">Jadwal Studi / Sekolah</span>
              <p className="text-xs text-zinc-200 font-bold truncate" title={schoolSchedule}>{schoolSchedule}</p>
            </div>
            <div className="bg-zinc-950/45 p-3 rounded-lg border border-zinc-900">
              <span className="text-[10px] text-zinc-500 block font-bold uppercase tracking-wide mb-1">Kerja & Freelance</span>
              <p className="text-xs text-zinc-200 font-bold truncate" title={jobType}>{jobType}</p>
            </div>
            <div className="bg-zinc-950/45 p-3 rounded-lg border border-zinc-900">
              <span className="text-[10px] text-zinc-500 block font-bold uppercase tracking-wide mb-1">Jadwal Dadakan & Deadline</span>
              <p className="text-xs text-zinc-200 font-bold truncate" title={adHocHandling}>{adHocHandling}</p>
            </div>
            <div className="bg-zinc-950/45 p-3 rounded-lg border border-zinc-900">
              <span className="text-[10px] text-zinc-500 block font-bold uppercase tracking-wide mb-1">Bangun & Tidur</span>
              <p className="text-xs text-emerald-400 font-mono font-bold">{wakeTime} - {sleepTime}</p>
            </div>
            <div className="bg-zinc-950/45 p-3 rounded-lg border border-zinc-900 col-span-2">
              <span className="text-[10px] text-zinc-500 block font-bold uppercase tracking-wide mb-1">Gaya Kerja & Rutinitas</span>
              <p className="text-xs text-zinc-200 font-bold truncate" title={activityPref}>{activityPref}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-950/30 p-4 border border-zinc-900 rounded-xl">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-450 animate-pulse flex-shrink-0" />
              <p className="text-[11px] text-zinc-400 font-medium">Data siap dipadukan dengan kecerdasan AI untuk membuat agenda ideal harian.</p>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={resetChat}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 font-semibold text-xs rounded-xl border border-zinc-800 cursor-pointer"
              >
                Atur Ulang
              </button>
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-black font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer font-sans"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Membuat Jadwal Cerdas...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Rancang Agenda Cerdas AI
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backend errors */}
      {error && (
        <div className="mt-4 p-3.5 bg-red-950/20 border border-red-900 text-red-405 text-xs rounded-xl">
          {error}
        </div>
      )}

      {/* List of successfully generated tasks preview / save panel */}
      {generatedTasks.length > 0 && (
        <div className="mt-5 border-t border-zinc-900 pt-5">
          <h3 className="text-xs font-bold text-zinc-100 mb-3 flex items-center gap-1.5 uppercase tracking-wider">
            <Check className="w-4 h-4 text-emerald-400" /> Hasil Rekomendasi Jadwal AI:
          </h3>
          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {generatedTasks.map((t, idx) => (
              <div
                key={idx}
                className="flex items-start justify-between p-3.5 bg-zinc-950 border border-zinc-850 rounded-xl"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold bg-zinc-900 border border-zinc-800 text-zinc-450 px-2 py-0.5 rounded">
                      {t.startTime} - {t.endTime}
                    </span>
                    <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded tracking-wide border ${
                      t.routine === "work" ? "bg-purple-950/20 border-purple-900/40 text-purple-400" :
                      t.routine === "habit" ? "bg-emerald-950/20 border-emerald-900/40 text-emerald-400" :
                      "bg-amber-950/20 border-amber-900/40 text-amber-400"
                    }`}>
                      {t.routine === "work" ? "Kerja/Fokus" : t.routine === "habit" ? "Kebiasaan" : "Waktu Luang"}
                    </span>
                  </div>
                  <h4 className="font-bold text-xs text-zinc-150 mt-1.5">{t.title}</h4>
                  {t.notes && <p className="text-[10px] text-zinc-500 mt-1">{t.notes}</p>}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-5 pt-4 border-t border-zinc-900">
            {isSaved ? (
              <span className="text-xs text-emerald-400 font-bold flex items-center gap-1.5 animate-pulse">
                ✓ Berhasil didaftarkan ke daftar agenda harian Anda!
              </span>
            ) : (
              <span className="text-xs text-amber-400 font-medium flex items-center gap-1.5 font-sans">
                💡 Jadwal di atas masih berupa draf rekomendasi AI Coach.
              </span>
            )}

            <div className="flex gap-2">
              {!isSaved ? (
                <>
                  <button
                    onClick={() => {
                      setGeneratedTasks([]);
                    }}
                    className="px-4 py-2 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 text-xs font-semibold rounded-xl border border-zinc-850 cursor-pointer transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleSaveSchedule}
                    className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-black text-xs font-extrabold rounded-xl shadow-md transition-colors cursor-pointer text-center flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Simpan Agenda Ke Hari Ini
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setGeneratedTasks([]);
                    resetChat();
                  }}
                  className="px-5 py-2 bg-zinc-800 hover:bg-zinc-750 text-white text-xs font-bold rounded-xl shadow-md transition-colors cursor-pointer text-center"
                >
                  Selesai & Tutup
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
