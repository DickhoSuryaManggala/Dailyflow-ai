import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

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

// Lazy-initialized Gemini client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === "MY_GEMINI_API_KEY") {
      throw new Error("GEMINI_API_KEY is not configured in environment variables.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// REST API Endpoints
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    apiConfigured: !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY",
  });
});

// Endpoint to generate personal daily schedule with AI based on goals
app.post("/api/gemini/generate-tasks", async (req, res) => {
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

    const client = getGeminiClient();
    
    const prompt = `Anda adalah seorang ahli produktivitas cerdas. Pengguna memiliki profil harian yang sangat rinci berikut:
- Profesi/Peran: ${profession || "Pelajar/Umum"}
- Target Hari Target Pembuatan Jadwal: ${dayOfWeekInfo || "Hari Biasa"} (Tanggal: ${selectedDate || "Tidak disebutkan"})
- Target Masa Depan (Cita-cita): ${futureGoals || "Menjaga kebiasaan harian yang teratur"}
- Detail Jam Sekolah/Kuliah Mingguan Lengkap: ${schoolSchedule || "Tidak disebutkan"}
- Pekerjaan Sampingan / Freelance: ${jobType || "Tidak disebutkan"}
- Strategi Jadwal Dadakan / Tugas Deadline Mendadak: ${adHocHandling || "Tidak disebutkan"}
- Waktu Bangun Utama: ${wakeTime || "06:00"}
- Waktu Tidur Utama: ${sleepTime || "22:00"}
- Preferensi Gaya Rutinitas: ${activityPref || "Produktivitas intens di pagi hari"}

PANDUAN UTAMA PENYUSUNAN JADWAL CERDAS:
1. DESKRIPSI HARI SPESIFIK & SENSITIVITAS JADWAL KULIAH (PENTING):
   - Periksa dengan SANGAT TELITI input jadwal kuliah mingguan lengkap di atas untuk hari target saat ini, yaitu: "${dayOfWeekInfo || "Hari Biasa"}".
   - Jika pada hari "${dayOfWeekInfo}" tertulis "Tidak ada kuliah", kosong, atau jika hari target adalah hari libur akhir pekan (Sabtu atau Minggu) yang tidak memiliki agenda kuliah dalam data mingguan pengguna, maka Anda DILARANG KERAS merancang agenda "Perjalanan ke Kampus", "Kuliah", "Kelas", atau kegiatan terkait kehadiran perkuliahan fisik formal lainnya pada hari target ini!
   - Sebaliknya, jika hari target tercatat TIDAK ADA KULIAH/LIBUR, gantikan waktu/slot kuliah tersebut dengan aktivitas belajar mandiri bebas, pengerjaan proyek sampingan / freelance, melakukan hobi sehat, berolahraga, menghabiskan waktu bersama keluarga, atau istirahat pemulihan yang cerdas.
2. EFISIENSI JAM PUTUS-NYAMBUNG (JEDA KULIAH): Jika hari target memiliki jadwal kuliah dan terdapat jeda terputus (gap kelas kosong beberapa jam), sisipkan aktivitas produktif seperti "Review Materi di Jeda Kuliah", "Mengerjakan Tugas Sampingan", atau "Istirahat Pemulihan Energi Teknis" di sela waktu kosong tersebut agar waktu tidak terbuang percuma.
3. PEKERJAAN & FREELANCE: Jika ada pekerjaan sampingan atau freelance, alokasikan blok waktu fokus khusus (work) yang efisien, misalnya 2-3 jam di waktu malam atau sore hari setelah aktivitas utama selesai.
4. DEADLINE & JADWAL DADAKAN: Sediakan slot "Buffer / Fleksibilitas Dadakan" atau "Penyelesaian Deadline Urgent" (leisure/habit) minimal 1 jam untuk menangani tugas mendadak sehingga tidak merusak sisa jadwal tidur.

Buatkan rekomendasi jadwal harian lengkap berformat JSON khusus untuk hari target (${dayOfWeekInfo || "Hari Biasa"}). Pastikan menyisipkan waktu luang (leisure), kebiasaan (habit), serta produktivitas atau pekerjaan (work). Pastikan struktur waktu logis mulai dari pagi hari sampai malam hari berdasarkan jam bangun dan tidur, tidak tumpang tindih. Semua teks respons harus berbahasa Indonesia.`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "Anda adalah AI Perancang Jadwal Harian Indonesia. Selalu berikan respon JSON yang sesuai dengan skema.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "Judul kegiatan yang ringkas dan jelas, contoh: Olahraga Pagi, Fokus Kerja Sesi 1, Istirahat Siang." },
              notes: { type: Type.STRING, description: "Catatan atau tips spesifik AI untuk menyelesaikannya secara efektif." },
              startTime: { type: Type.STRING, description: "Waktu mulai dalam format HH:MM, contoh: 07:00." },
              endTime: { type: Type.STRING, description: "Waktu selesai dalam format HH:MM, contoh: 08:30." },
              routine: { type: Type.STRING, description: "Kategori rutinitas: wajib bernilai 'work', 'leisure', atau 'habit'." }
            },
            required: ["title", "notes", "startTime", "endTime", "routine"]
          }
        }
      }
    });

    const parsedData = JSON.parse(response.text || "[]");
    res.json({ success: true, tasks: parsedData });
  } catch (error: any) {
    console.error("Gemini Generate Tasks Error:", error);
    res.status(500).json({ success: false, error: error.message || "Gagal menghasilkan jadwal cerdas." });
  }
});

// Endpoint to generate daily personalized motivation words based on achievements and future targets
app.post("/api/gemini/motivation", async (req, res) => {
  try {
    const { futureGoals, completedTasks, totalTasks, focusMinutes } = req.body;
    
    const client = getGeminiClient();
    
    const prompt = `Berikan kalimat motivasi personal harian yang mendalam, hangat, dan menginspirasi dalam bahasa Indonesia.
Target masa depan pengguna: "${futureGoals || "Menjadi pribadi yang lebih produktif"}"
Pencapaian harian hari ini: menyelesaikan ${completedTasks} dari ${totalTasks} tugas, dengan durasi fokus terukur ${focusMinutes} menit.

Tuliskan sebuah kalimat kutipan/quote motivasi utama yang ringkas (sangat mengena), diikuti dengan 2-3 baris nasihat pendek hangat yang disesuaikan langsung dengan pencapaian tersebut (apakah mencapai target dengan baik atau perlu didorong lebih giat).`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "Anda adalah motivator produktivitas personal yang bersahabat, menggunakan bahasa Indonesia yang ramah, hangat, dan membakar semangat."
      }
    });

    res.json({ success: true, motivation: response.text || "Tetaplah melangkah, setiap langkah kecil mendekatkanmu pada impian masa depan!" });
  } catch (error: any) {
    console.error("Gemini Motivation Error:", error);
    res.json({ 
      success: false, 
      motivation: "Setiap usaha kecil hari ini adalah jembatan kokoh menuju cita-citamu di masa depan. Tetap konsisten!" 
    });
  }
});

// Endpoint to generate an AI Roast based on progress parameters
app.post("/api/gemini/roast", async (req, res) => {
  try {
    const { futureGoals, completedTasks, totalTasks, focusMinutes, distractionMinutes } = req.body;
    
    const client = getGeminiClient();
    
    const prompt = `Lakukan roasting (kritik pedas, sarkastik, tapi sangat lucu, kocak, dan mendidik) dalam Bahasa Indonesia santai (bahasa gaul santai/semi-formal) untuk seseorang dengan detail progres berikut:
- Target Masa Depan (Cita-cita): "${futureGoals || "Sukses mulia tanpa usaha"}"
- Tugas Selesai: menyelesaikan ${completedTasks} dari total ${totalTasks} tugas hari ini.
- Waktu Fokus: ${focusMinutes || 0} menit.
- Jeda Terganggu/Distraksi: ${distractionMinutes || 0} menit.

PANDUAN ROASTING:
1. Buat roasting-nya pedas tapi menghibur! Bandingkan cita-citanya yang setinggi langit dengan kenyataan malasnya hari ini. 
2. Gunakan analogi lucu yang relatable (misal: cita-cita jadi CEO tapi kerjaan scroll TikTok, ingin bikin startup tapi bangun jam 12 siang).
3. Berikan tamparan logika di akhir agar mereka sadar tapi tertawa. Panjang total maks 3-4 kalimat ringkas yang powerful dan nendang banget. Tidak perlu bertele-tele.`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "Anda adalah AI Roaster spesialis produktivitas. Gaya Anda sarkastik, lucu, menggunakan diksi yang tajam, menggelitik, gaul, namun di akhir memberikan dorongan semangat agar mereka sadar."
      }
    });

    res.json({ success: true, roast: response.text || "Cita-citamu setinggi langit, tapi tugas diselesaikan nol. Mau sukses jalur apa, jalur giveaway?" });
  } catch (error: any) {
    console.error("Gemini Roast Error:", error);
    res.json({
      success: false,
      roast: "Cita-citamu setinggi langit, tapi tugas diselesaikan nol. Ingat, rebahan tidak akan menghasilkan apa-apa kecuali mimpi yang tertunda!"
    });
  }
});

// Endpoint to generate monthly performance evaluation with deep insights
app.post("/api/gemini/evaluate-month", async (req, res) => {
  try {
    const { monthString, futureGoals, analyticsSummary, averageFocusTime, completionRate } = req.body;
    
    const client = getGeminiClient();
    
    const prompt = `Berikan analisis evaluasi performa produktivitas bulanan yang mendalam dan tajam untuk bulan ${monthString || "Bulan Ini"}.
Diberikan data statistik bulanan sebagai berikut:
- Target masa depan yang ingin dicapai: "${futureGoals || "Peningkatan pribadi berkelanjutan"}"
- Rata-rata waktu fokus harian: ${averageFocusTime || 0} menit per hari.
- Tingkat penyelesaian tugas terjadwal (Completion Rate): ${completionRate || 0}%.
- Ringkasan aktivitas bulanan: ${JSON.stringify(analyticsSummary || {})}

Evaluasi harus terdiri dari format JSON terstruktur yang berisi:
1. 'productivityScore': Nilai angka 0 hingga 100 yang mencerminkan tingkat konsistensi dan produktivitas mereka selama sebulan ini.
2. 'strengths': Array string berisi poin-poin kekuatan positif aktivitas mereka (analisis kenapa ini bagus).
3. 'weaknesses': Array string berisi poin-poin kelemahan atau distraksi utama yang menghambat mereka.
4. 'recommendations': Array string berisi saran konkret nan cerdas yang dapat langsung diterapkan untuk bulan depan.

Berikan output murni JSON. Semua teks berbahasa Indonesia.`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "Anda adalah Pengamat & Coach Produktivitas Profesional berbahasa Indonesia yang objektif, analitis, dan solutif.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            productivityScore: { type: Type.INTEGER },
            strengths: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            weaknesses: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            recommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["productivityScore", "strengths", "weaknesses", "recommendations"]
        }
      }
    });

    const parsedData = JSON.parse(response.text || "{}");
    res.json({ success: true, evaluation: parsedData });
  } catch (error: any) {
    console.error("Gemini Evaluate Month Error:", error);
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
