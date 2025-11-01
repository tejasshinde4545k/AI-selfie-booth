import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import qrcode from "qrcode";
import nodemailer from "nodemailer";
import { fileURLToPath } from "url";
import { generateFinalImage } from "./generateImage.js"; // ✅ Firefly version

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==============================
// 🧩 Middleware setup
// ==============================
app.use(cors());
app.use(express.json());
app.use("/public", express.static(path.join(__dirname, "public")));

// ==============================
// 🖼 File Upload setup
// ==============================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "uploads");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `${timestamp}${ext}`);
  },
});

const upload = multer({ storage });

// ==============================
// 📧 Nodemailer setup
// ==============================
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Gmail App Password
  },
});

// ==============================
// 🚀 Upload + Background Removal Route
// ==============================
app.post("/api/upload", upload.single("selfie"), async (req, res) => {
  const { theme = "professional", name = "", email = "" } = req.body || {};

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file uploaded" });
    }

    const inputPath = req.file.path;
    console.log("🖼 Uploaded file:", inputPath);
    console.log("🎭 Theme:", theme);
    console.log("📧 Email:", email || "(not provided)");

    // ✅ Process image using Adobe Firefly API
    const resultPath = await generateFinalImage(inputPath, theme);
    const publicUrl = `${req.protocol}://${req.get("host")}/public/${path.basename(resultPath)}`;

    // ✅ Generate QR code
    let qrDataUrl = null;
    try {
      qrDataUrl = await qrcode.toDataURL(publicUrl);
    } catch (qrErr) {
      console.error("⚠️ QR code generation failed:", qrErr.message);
    }

    // ✅ Send email if provided
    if (email) {
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2>Hi ${name || "there"} 👋</h2>
          <p>Your AI Selfie Booth photo is ready!</p>
          <p><b>Theme:</b> ${theme}</p>
          ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR Code" width="150" />` : ""}
          <p>Click below to view your photo:</p>
          <a href="${publicUrl}" style="display:inline-block;background:#00c4cc;color:#fff;padding:10px 20px;border-radius:5px;text-decoration:none;">View Image</a>
          <br/><br/>
          <img src="${publicUrl}" alt="Your AI Selfie" width="300" style="border-radius:10px;margin-top:10px;" />
          <p style="margin-top:30px;">Thanks for using our AI Selfie Booth 💫</p>
        </div>
      `;

      await transporter.sendMail({
        from: `"AI Selfie Booth" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "🎉 Your AI Selfie Booth Photo is Ready!",
        html: htmlContent,
      });

      console.log(`📨 Email sent successfully to ${email}`);
    } else {
      console.warn("⚠️ No email provided — skipping email send.");
    }

    // ✅ Delete temp file
    fs.unlink(inputPath, (err) => {
      if (err) console.error("⚠️ Failed to delete temp file:", err.message);
    });

    // ✅ Respond
    res.json({
      success: true,
      theme,
      imageUrl: publicUrl,
      fileName: path.basename(resultPath),
      qrDataUrl,
    });
  } catch (err) {
    console.error("❌ /api/upload failed:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==============================
// 🏠 Root Route
// ==============================
app.get("/", (req, res) => {
  res.send("✅ AI Selfie Booth backend running successfully on Render!");
});

// ==============================
// ✅ Start Server
// ==============================
app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
