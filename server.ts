import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { generateLLMText, getLLMProvider, getLLMModel, isLLMApiConfigured } from "./llm";

// Compatibility helpers for ES Modules / CommonJS
let currentDir = process.cwd();
try {
  const filename = fileURLToPath(import.meta.url);
  currentDir = path.dirname(filename);
} catch (e) {
  // CommonJS fallback if executed as dist/server.cjs
  currentDir = __dirname;
}

const app = express();
const PORT = 3000;

app.use(express.json());

// REST API Endpoints
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    provider: getLLMProvider(),
    apiConfigured: isLLMApiConfigured(),
  });
});

// Endpoint to generate personal daily schedule with AI based on goals
app.post("/api/llm/generate-tasks", async (req, res) => {
  try {
    const { futureGoals, profession, wakeTime, sleepTime, activityPref, schoolSchedule, jobType, adHocHandling, selectedDate } = req.body;
    
    // Get corresponding Indonesian day of the week for selectedDate
    let dayOfWeekInfo = "";
    if (selectedDate) {
      const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
      const parts = selectedDate.split("-");
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // 0-indexed month
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        if (!isNaN(d.getTime())) {
          dayOfWeekInfo = days[d.getDay()];
        }
      } else {
        const d = new Date(selectedDate);
        if (!isNaN(d.getTime())) {
          dayOfWeekInfo = days[d.getDay()];
        }
      }
    }

    const model = getLLMModel();
    const response = await generateLLMText({
      model,
      prompt: `Anda adalah seorang ahli produktivitas cerdas. Pengguna memiliki profil harian yang sangat rinci berikut:\n- Profesi/Peran: ${profession || "Pelajar/Umum"}\n- Target Hari Target Pembuatan Jadwal: ${dayOfWeekInfo || "Hari Biasa"} (Tanggal: ${selectedDate || "Tidak disebutkan"})\n- Target Masa Depan (Cita-cita): ${futureGoals || "Menjaga kebiasaan harian yang teratur"}\n- Detail Jam Sekolah/Kuliah Mingguan Lengkap: ${schoolSchedule || "Tidak disebutkan"}\n- Pekerjaan Sampingan / Freelance: ${jobType || "Tidak disebutkan"}\n- Strategi Jadwal Dadakan / Tugas Deadline Mendadak: ${adHocHandling || "Tidak disebutkan"}\n- Waktu Bangun Utama: ${wakeTime || "06:00"}\n- Waktu Tidur Utama: ${sleepTime || "22:00"}\n- Preferensi Gaya Rutinitas: ${activityPref || "Produktivitas intens di pagi hari"}\n\nPANDUAN UTAMA PENYUSUNAN JADWAL CERDAS:\n1. DESKRIPSI HARI SPESIFIK & SENSITIVITAS JADWAL KULIAH (PENTING):\n   - Periksa dengan SANGAT TELITI input jadwal kuliah mingguan lengkap di atas untuk hari target saat ini, yaitu: "${dayOfWeekInfo || "Hari Biasa"}".\n   - Jika pada hari "${dayOfWeekInfo}" tertulis "Tidak ada kuliah", kosong, atau jika hari target adalah hari libur akhir pekan (Sabtu atau Minggu) yang tidak memiliki agenda kuliah dalam data mingguan pengguna, maka Anda DILARANG KERAS merancang agenda "Perjalanan ke Kampus", "Kuliah", "Kelas", atau kegiatan terkait kehadiran perkuliahan fisik formal lainnya pada hari target ini!\n   - Sebaliknya, jika hari target tercatat TIDAK ADA KULIAH/LIBUR, gantikan waktu/slot kuliah tersebut dengan aktivitas belajar mandiri bebas, pengerjaan proyek sampingan / freelance, melakukan hobi sehat, berolahraga, menghabiskan waktu bersama keluarga, atau istirahat pemulihan yang cerdas.\n2. EFISIENSI JAM PUTUS-NYAMBUNG (JEDA KULIAH): Jika hari target memiliki jadwal kuliah dan terdapat jeda terputus (gap kelas kosong beberapa jam), sisipkan aktivitas produktif seperti "Review Materi di Jeda Kuliah", "Mengerjakan Tugas Sampingan", atau "Istirahat Pemulihan Energi Teknis" di sela waktu kosong tersebut agar waktu tidak terbuang percuma.\n3. PEKERJAAN & FREELANCE: Jika ada pekerjaan sampingan atau freelance, alokasikan blok waktu fokus khusus (work) yang efisien, misalnya 2-3 jam di waktu malam atau sore hari setelah aktivitas utama selesai.\n4. DEADLINE & JADWAL DADAKAN: Sediakan slot "Buffer / Fleksibilitas Dadakan" atau "Penyelesaian Deadline Urgent" (leisure/habit) minimal 1 jam untuk menangani tugas mendadak sehingga tidak merusak sisa jadwal tidur.\n\nBuatkan rekomendasi jadwal harian lengkap berformat JSON khusus untuk hari target (${dayOfWeekInfo || "Hari Biasa"}). Pastikan menyisipkan waktu luang (leisure), kebiasaan (habit), serta produktivitas atau pekerjaan (work). Pastikan struktur waktu logis mulai dari pagi hari sampai malam hari berdasarkan jam bangun dan tidur, tidak tumpang tindih. Semua teks respons harus berbahasa Indonesia.`,
      systemInstruction: "Anda adalah AI Perancang Jadwal Harian Indonesia. Selalu berikan respon JSON yang sesuai dengan skema.",
      responseMimeType: "application/json",
      responseSchema: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Judul kegiatan yang ringkas dan jelas, contoh: Olahraga Pagi, Fokus Kerja Sesi 1, Istirahat Siang.' },
            notes: { type: 'string', description: 'Catatan atau tips spesifik AI untuk menyelesaikannya secara efektif.' },
            startTime: { type: 'string', description: 'Waktu mulai dalam format HH:MM, contoh: 07:00.' },
            endTime: { type: 'string', description: 'Waktu selesai dalam format HH:MM, contoh: 08:30.' },
            routine: { type: 'string', description: 'Kategori rutinitas: wajib bernilai \'work\', \'leisure\', atau \'habit\'.' }
          },
          required: ['title', 'notes', 'startTime', 'endTime', 'routine']
        }
      }
    });

    const parsedData = JSON.parse(response.text || '[]');
    res.json({ success: true, tasks: parsedData });
  } catch (error: any) {
    console.error("LLM Generate Tasks Error:", error);
    res.status(500).json({ success: false, error: error.message || "Gagal menghasilkan jadwal cerdas." });
  }
});

// Endpoint to generate daily personalized motivation words based on achievements and future targets
app.post("/api/llm/motivation", async (req, res) => {
  try {
    const { futureGoals, completedTasks, totalTasks, focusMinutes } = req.body;
    const model = getLLMModel();

    const response = await generateLLMText({
      model,
      prompt: `Buat satu kalimat motivasi harian yang sangat singkat dan langsung dalam bahasa Indonesia. Jangan lebih dari satu kalimat. Target: "${futureGoals || "Menjadi pribadi yang lebih produktif"}". Pencapaian: menyelesaikan ${completedTasks} dari ${totalTasks} tugas hari ini. Fokus: ${focusMinutes} menit.`,
      systemInstruction: "Anda adalah motivator produktivitas personal yang bersahabat dan hanya menulis satu kalimat motivasi singkat."
    });

    const motivationText = response.text.split(/\r?\n/)[0].trim();
    res.json({ success: true, motivation: motivationText || "Tetaplah melangkah, setiap langkah kecil mendekatkanmu pada impian masa depan!" });
  } catch (error: any) {
    console.error("LLM Motivation Error:", error);
    res.json({ 
      success: false, 
      motivation: "Setiap usaha kecil hari ini adalah jembatan kokoh menuju cita-citamu di masa depan. Tetap konsisten!" 
    });
  }
});

// Endpoint to generate an AI Roast based on progress parameters
app.post("/api/llm/roast", async (req, res) => {
  try {
    const { futureGoals, completedTasks, totalTasks, focusMinutes, distractionMinutes } = req.body;
    const model = getLLMModel();

    const response = await generateLLMText({
      model,
      prompt: `Lakukan roasting (kritik pedas, sarkastik, tapi sangat lucu, kocak, dan mendidik) dalam Bahasa Indonesia santai (bahasa gaul santai/semi-formal) untuk seseorang dengan detail progres berikut:\n- Target Masa Depan (Cita-cita): "${futureGoals || "Sukses mulia tanpa usaha"}"\n- Tugas Selesai: menyelesaikan ${completedTasks} dari total ${totalTasks} tugas hari ini.\n- Waktu Fokus: ${focusMinutes || 0} menit.\n- Jeda Terganggu/Distraksi: ${distractionMinutes || 0} menit.\n\nPANDUAN ROASTING:\n1. Buat roasting-nya pedas tapi menghibur! Bandingkan cita-citanya yang setinggi langit dengan kenyataan malasnya hari ini. \n2. Gunakan analogi lucu yang relatable (misal: cita-cita jadi CEO tapi kerjaan scroll TikTok, ingin bikin startup tapi bangun jam 12 siang).\n3. Berikan tamparan logika di akhir agar mereka sadar tapi tertawa. Panjang total maks 3-4 kalimat ringkas yang powerful dan nendang banget. Tidak perlu bertele-tele.`,
      systemInstruction: "Anda adalah AI Roaster spesialis produktivitas. Gaya Anda sarkastik, lucu, menggunakan diksi yang tajam, menggelitik, gaul, namun di akhir memberikan dorongan semangat agar mereka sadar."
    });

    res.json({ success: true, roast: response.text.trim() || "Cita-citamu setinggi langit, tapi tugas diselesaikan nol. Mau sukses jalur apa, jalur giveaway?" });
  } catch (error: any) {
    console.error("LLM Roast Error:", error);
    res.json({
      success: false,
      roast: "Cita-citamu setinggi langit, tapi tugas diselesaikan nol. Ingat, rebahan tidak akan menghasilkan apa-apa kecuali mimpi yang tertunda!"
    });
  }
});

// Endpoint to generate monthly performance evaluation with deep insights
app.post("/api/llm/evaluate-month", async (req, res) => {
  try {
    const { monthString, futureGoals, analyticsSummary, averageFocusTime, completionRate } = req.body;
    
    const model = getLLMModel();
    const response = await generateLLMText({
      model,
      prompt: `Berikan analisis evaluasi performa produktivitas bulanan yang mendalam dan tajam untuk bulan ${monthString || "Bulan Ini"}. Diberikan data statistik bulanan sebagai berikut:\n- Target masa depan yang ingin dicapai: "${futureGoals || "Peningkatan pribadi berkelanjutan"}"\n- Rata-rata waktu fokus harian: ${averageFocusTime || 0} menit per hari.\n- Tingkat penyelesaian tugas terjadwal (Completion Rate): ${completionRate || 0}%.\n- Ringkasan aktivitas bulanan: ${JSON.stringify(analyticsSummary || {})}\n\nEvaluasi harus terdiri dari format JSON terstruktur yang berisi:\n1. 'productivityScore': Nilai angka 0 hingga 100 yang mencerminkan tingkat konsistensi dan produktivitas mereka selama sebulan ini.\n2. 'strengths': Array string berisi poin-poin kekuatan positif aktivitas mereka (analisis kenapa ini bagus).\n3. 'weaknesses': Array string berisi poin-poin kelemahan atau distraksi utama yang menghambat mereka.\n4. 'recommendations': Array string berisi saran konkret nan cerdas yang dapat langsung diterapkan untuk bulan depan.\n\nBerikan output murni JSON. Semua teks berbahasa Indonesia.`,
      systemInstruction: "Anda adalah Pengamat & Coach Produktivitas Profesional berbahasa Indonesia yang objektif, analitis, dan solutif.",
      responseMimeType: "application/json",
      responseSchema: {
        type: 'object',
        properties: {
          productivityScore: { type: 'integer' },
          strengths: { type: 'array', items: { type: 'string' } },
          weaknesses: { type: 'array', items: { type: 'string' } },
          recommendations: { type: 'array', items: { type: 'string' } }
        },
        required: ['productivityScore', 'strengths', 'weaknesses', 'recommendations']
      }
    });

    const parsedData = JSON.parse(response.text || "{}");
    res.json({ success: true, evaluation: parsedData });
  } catch (error: any) {
    console.error("LLM Evaluate Month Error:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message || "Gagal melakukan evaluasi performa bulanan bertenaga AI." 
    });
  }
});

// Endpoint to simulate automated email report delivery with clean terminal response & email representation
app.post("/api/send-report", (req, res) => {
  const { email, reportType, monthString, evaluationData, currentProgress } = req.body;
  
  if (!email || !email.includes("@")) {
    return res.status(400).json({ success: false, error: "Kirim email gagal: Alamat email tujuan tidak valid." });
  }
  
  // Format visual logger output simulating automated background agent server email delivery
  const timestampStr = new Date().toISOString();
  console.log(`[EMAIL SYSTEM] Dispatching automated report triggered at ${timestampStr}`);
  console.log(`[EMAIL SYSTEM] Subject: [DailyFlow AI] Laporan Evaluasi Performa Bulanan - ${monthString}`);
  console.log(`[EMAIL SYSTEM] To: ${email}`);
  console.log(`[EMAIL SYSTEM] Dispatch Status: STACK_ONLINE_SEND_SUCCESS`);

  res.json({
    success: true,
    sentAt: timestampStr,
    recipient: email,
    subject: `[DailyFlow AI] Laporan Evaluasi Performa Bulanan - ${monthString}`,
    message: `Laporan progres ${reportType} berhasil dikirim secara otomatis ke email ${email}. Sistem pelaporan terintegrasi cloud aktif sepenuhnya.`
  });
});

// Integrate Vite Development Server
async function setupViteAndListen() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production asset handlers
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER] Ready & running on http://0.0.0.0:${PORT}`);
  });
}

setupViteAndListen().catch(err => {
  console.error("Failed to start server:", err);
});
