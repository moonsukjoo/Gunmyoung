import express from "express";
import path from "path";
import nodemailer from "nodemailer";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

const app = express();
const PORT = 3000;

let firestoreDb: any;

// Initialize Firebase Admin SDK
try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    admin.initializeApp({
      projectId: firebaseConfig.projectId
    });
    console.log("Firebase Admin initialized for project:", firebaseConfig.projectId);
    
    const dbId = firebaseConfig.firestoreDatabaseId || "(default)";
    firestoreDb = getFirestore(undefined, dbId);
  } else {
    admin.initializeApp();
    console.log("Firebase Admin initialized using default credentials");
    firestoreDb = getFirestore();
  }
} catch (error) {
  console.error("Firebase Admin initialization error:", error);
}

// Set maximum request body sizes to accept large PDF or Excel Base64 payloads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Admin Auth User Reset API Endpoint
app.post("/api/auth/reset-user", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, error: "이메일이 누락되었습니다." });
  }

  try {
    const userRecord = await admin.auth().getUserByEmail(email.toLowerCase().trim());
    await admin.auth().deleteUser(userRecord.uid);
    console.log(`Successfully deleted Firebase Auth user with email: ${email} (UID: ${userRecord.uid})`);
    return res.json({ success: true, message: "Firebase Auth 계정이 삭제되었습니다. 로그인 시 자동 재생성됩니다." });
  } catch (error: any) {
    if (error.code === "auth/user-not-found" || error.code === "user-not-found") {
      console.log(`Auth user for email ${email} not found. No action needed.`);
      return res.json({ success: true, message: "이미 Auth 계정이 존재하지 않습니다." });
    }
    console.error("Failed to delete Auth user:", error);
    return res.status(500).json({ success: false, error: error.message || "Auth 계정 삭제 실패" });
  }
});

// In-memory store for safe temporary report downloads (auto-expires in 15 minutes)
const reportDownloadCache = new Map<string, { filename: string; buffer: Buffer; mimeType: string; expiresAt: number }>();

// Periodic cleanup of expired cache
setInterval(() => {
  const now = Date.now();
  for (const [key, item] of reportDownloadCache.entries()) {
    if (item.expiresAt < now) {
      reportDownloadCache.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Endpoint to prepare download token
app.post("/api/reports/prepare-download", (req, res) => {
  const { filename, base64Data, mimeType } = req.body;
  if (!filename || !base64Data) {
    return res.status(400).json({ success: false, error: "파일명 또는 데이터가 누락되었습니다." });
  }

  let cleanBase64 = base64Data;
  if (base64Data.includes(";base64,")) {
    cleanBase64 = base64Data.split(";base64,")[1];
  }

  const token = "rep_" + Math.random().toString(36).substring(2, 9) + "_" + Date.now();
  const buffer = Buffer.from(cleanBase64, "base64");

  reportDownloadCache.set(token, {
    filename,
    buffer,
    mimeType: mimeType || (filename.endsWith(".pdf") ? "application/pdf" : "application/octet-stream"),
    expiresAt: Date.now() + 15 * 60 * 1000 // 15 mins
  });

  return res.json({
    success: true,
    token,
    downloadUrl: `/api/reports/download/${token}/${encodeURIComponent(filename)}`
  });
});

// Endpoint to stream download with proper Content-Disposition
app.get("/api/reports/download/:token/:filename", (req, res) => {
  const { token } = req.params;
  const item = reportDownloadCache.get(token);
  if (!item) {
    return res.status(404).send("다운로드 세션이 만료되었습니다. 앱에서 다시 다운로드 버튼을 눌러주세요.");
  }

  res.setHeader("Content-Type", item.mimeType);
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(item.filename)}`);
  res.setHeader("Content-Length", item.buffer.length);
  return res.send(item.buffer);
});

// Real Email sending API Endpoint
app.post("/api/send-email", async (req, res) => {
  const { to, subject, filename, base64Data } = req.body;

  if (!to || !filename || !base64Data) {
    return res.status(400).json({
      success: false,
      error: "전송에 필요한 필수 매개변수(to, filename, base64Data)가 누락되었습니다."
    });
  }

  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = parseInt(process.env.SMTP_PORT || "465", 10);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpSecure = process.env.SMTP_SECURE === "false" ? false : true;
  const smtpFrom = process.env.SMTP_FROM || `건명기업 스마트 안전 관리 <${smtpUser || "noreply@gmail.com"}>`;

  if (!smtpUser || !smtpPass) {
    console.error("SMTP Credentials are not configured in environment variables.");
    return res.status(400).json({
      success: false,
      error: "SMTP 연동 설정이 완료되지 않았습니다.",
      details: "AI Studio의 'Settings -> Secrets' 메뉴에서 SMTP_USER와 SMTP_PASS(Google 앱 비밀번호 등)를 추가하신 후 디바이스에서 다시 발송해 주세요."
    });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });

    let cleanBase64 = base64Data;
    if (base64Data.includes(";base64,")) {
      cleanBase64 = base64Data.split(";base64,")[1];
    }

    const fileBuffer = Buffer.from(cleanBase64, "base64");

    const mailOptions = {
      from: smtpFrom,
      to: to,
      subject: subject || `[건명기업] 스마트 안전 관리 시스템 - ${filename}`,
      text: `안녕하세요. 건명기업 스마트 안전 관리 시스템입니다.\n\n요청하신 보고서 파일 [ ${filename} ]을 첨부하여 발송해 드립니다.\n\n감사합니다.\n- 건명기업 안전팀 드림.`,
      attachments: [
        {
          filename: filename,
          content: fileBuffer
        }
      ]
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully: ", info.messageId);

    return res.json({
      success: true,
      messageId: info.messageId,
      message: "이메일 전송이 성공하였습니다."
    });
  } catch (error: any) {
    console.error("Failed to send email via SMTP:", error);
    return res.status(500).json({
      success: false,
      error: "메일 전송 실패",
      details: error.message || "서버 혹은 SMTP 설정에 문제가 발생했습니다."
    });
  }
});

// Serve health status
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Configure Vite or Static server
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Vite middleware for development
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
