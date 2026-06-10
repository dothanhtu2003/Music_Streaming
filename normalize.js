/**
 * normalize.js — Safe Audio Normalizer for Cloudinary
 *
 * Cách dùng:
 *   node normalize.js             → chạy thật toàn bộ
 *   node normalize.js --dry-run   → chỉ xem danh sách, không làm gì
 *   node normalize.js --limit=2   → chạy thử 2 file đầu tiên
 */

require("dotenv").config();
const cloudinary = require("cloudinary").v2;
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

// ─── Config ───────────────────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const FOLDER        = "music-streaming/audio";
// [FIX P1] Backup folder khác prefix hoàn toàn → không bị lấy nhầm lần sau
const BACKUP_FOLDER = "music-streaming-backup/audio";
const TEMP_DIR      = path.join(__dirname, "temp_audio");
const FFMPEG        = process.env.FFMPEG_PATH || "ffmpeg";
// [FIX P2] Chỉ xử lý mp3 để đảm bảo URL/format không đổi
// Sau này muốn xử lý thêm format thì cần preserve codec riêng
const AUDIO_EXTS    = ["mp3"];

// ─── Parse args ───────────────────────────────────────────────────────────────
const args     = process.argv.slice(2);
const DRY_RUN  = args.includes("--dry-run");
const limitArg = args.find((a) => a.startsWith("--limit="));
const LIMIT    = limitArg ? parseInt(limitArg.split("=")[1], 10) : Infinity;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function safeCleanup(...files) {
  for (const f of files) {
    try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (_) {}
  }
}

function validateFfmpeg() {
  const result = spawnSync(FFMPEG, ["-version"], { encoding: "utf8" });

  if (result.error) {
    throw new Error(
      `Khong tim thay FFmpeg (${FFMPEG}). Hay cai FFmpeg hoac set FFMPEG_PATH trong .env.`
    );
  }

  if (result.status !== 0) {
    throw new Error(
      `FFmpeg khong chay duoc: ${result.stderr || result.stdout || "unknown error"}`
    );
  }
}

async function downloadFile(url, destPath) {
  const res = await axios({ url, responseType: "stream" });
  const writer = fs.createWriteStream(destPath);
  res.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}

function normalizeAudio(inputPath, outputPath) {
  const pass1 = spawnSync(FFMPEG, [
    "-i", inputPath,
    "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json",
    "-f", "null",
    "-",
  ], { encoding: "utf8" });

  if (pass1.error) {
    throw pass1.error;
  }

  const pass1Output = `${pass1.stdout || ""}\n${pass1.stderr || ""}`;

  if (pass1.status !== 0 && !pass1Output.includes("{")) {
    throw new Error(`FFmpeg pass 1 failed: ${pass1Output || "unknown error"}`);
  }

// Lấy JSON block cuối cùng — FFmpeg ghi loudnorm stats ở cuối output
  const allMatches = [...pass1Output.matchAll(/\{[^{}]*\}/g)];
  const jsonMatch = allMatches.length > 0 ? allMatches[allMatches.length - 1] : null;  

  if (!jsonMatch) {
    throw new Error("Khong doc duoc loudness data tu pass 1");
  }

  const stats = JSON.parse(jsonMatch[0]);

  execFileSync(FFMPEG, [
    "-y",
    "-i", inputPath,
    "-af", [
      "loudnorm=I=-14:TP=-1.5:LRA=11",
      `measured_I=${stats.input_i}`,
      `measured_TP=${stats.input_tp}`,
      `measured_LRA=${stats.input_lra}`,
      `measured_thresh=${stats.input_thresh}`,
      `offset=${stats.target_offset}`,
      "linear=true",
      "print_format=summary",
    ].join(":"),
    outputPath,
  ], { stdio: "pipe" });
}

async function uploadToCloudinary(filePath, publicId) {
  return cloudinary.uploader.upload(filePath, {
    resource_type: "video",
    public_id:     publicId,
    overwrite:     true,
    invalidate:    true,
  });
}

async function backupToCloudinary(sourceUrl, publicId) {
  // [FIX P1] Dùng timestamp trong backupId → chạy lại không ghi đè backup cũ
  const fileName = publicId.replace(`${FOLDER}/`, "");
  const backupId = `${BACKUP_FOLDER}/${Date.now()}_${fileName}`;

  return cloudinary.uploader.upload(sourceUrl, {
    resource_type: "video",
    public_id:     backupId,
    overwrite:     false, // [FIX P1] Không ghi đè nếu trùng tên
  });
}

// ─── Fetch all files ──────────────────────────────────────────────────────────
async function getAllAudioFiles() {
  let resources  = [];
  let nextCursor = null;

  do {
    const result = await cloudinary.api.resources({
      type:          "upload",
      resource_type: "video",
      prefix:        FOLDER,
      max_results:   100,
      next_cursor:   nextCursor,
    });
    resources  = resources.concat(result.resources);
    nextCursor = result.next_cursor || null;
  } while (nextCursor);

  return resources.filter((f) =>
    // [FIX P1] Chỉ lấy đúng folder gốc, không lấy audio-backup hay subfolder khác
    f.public_id.startsWith(`${FOLDER}/`) &&
    AUDIO_EXTS.includes(f.format)
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🎵 Audio Normalizer\n");
  if (DRY_RUN) console.log("🔍 DRY RUN — chỉ xem danh sách, không thay đổi gì\n");
  if (LIMIT !== Infinity) console.log(`⚠️  Chạy thử ${LIMIT} file đầu tiên\n`);

  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    console.error("❌ Thiếu CLOUDINARY credentials trong .env");
    process.exit(1);
  }

  const allFiles = await getAllAudioFiles();
  const files    = allFiles.slice(0, LIMIT === Infinity ? undefined : LIMIT);

  console.log(`📦 Tổng file mp3 trong "${FOLDER}": ${allFiles.length}`);
  console.log(`📋 Sẽ xử lý: ${files.length} file`);
  console.log(`💾 Backup tại: "${BACKUP_FOLDER}/<timestamp>_<tên file>"\n`);

  if (DRY_RUN) {
    files.forEach((f, i) => console.log(`  ${i + 1}. ${f.public_id} [${f.format}]`));
    console.log("\n✅ Dry run xong. Chạy lại không có --dry-run để xử lý thật.");
    return;
  }

  validateFfmpeg();
  ensureDir(TEMP_DIR);

  const failed = [];
  let success  = 0;

  for (let i = 0; i < files.length; i++) {
    const file       = files[i];
    const safeName   = file.public_id.replace(/[\/\\:*?"<>|]/g, "_");
    const inputPath  = path.join(TEMP_DIR, `${safeName}_original.mp3`);
    const outputPath = path.join(TEMP_DIR, `${safeName}_normalized.mp3`);

    console.log(`[${i + 1}/${files.length}] ${file.public_id}`);

    try {
      // 1. Backup file gốc (có timestamp, không ghi đè)
      process.stdout.write("  💾 Backing up...");
      await backupToCloudinary(file.secure_url, file.public_id);
      console.log(" ✅");

      // 2. Download về local
      process.stdout.write("  ⬇️  Downloading...");
      await downloadFile(file.secure_url, inputPath);
      console.log(" ✅");

      // 3. Two-pass normalize
      process.stdout.write("  🔊 Normalizing...");
      normalizeAudio(inputPath, outputPath);
      console.log(" ✅");

      // 4. Upload đè lên Cloudinary
      process.stdout.write("  ⬆️  Uploading...");
      await uploadToCloudinary(outputPath, file.public_id);
      console.log(" ✅");

      success++;
    } catch (err) {
      console.log(`\n  ❌ Lỗi: ${err.message}`);
      failed.push({ public_id: file.public_id, error: err.message });
    } finally {
      safeCleanup(inputPath, outputPath);
    }

    console.log("");
  }

  try { fs.rmdirSync(TEMP_DIR); } catch (_) {}

  if (failed.length > 0) {
    const logPath = path.join(__dirname, "normalize-errors.json");
    fs.writeFileSync(logPath, JSON.stringify(failed, null, 2));
    console.log(`⚠️  ${failed.length} file lỗi → xem chi tiết: normalize-errors.json\n`);
  }

  console.log("════════════════════════════════════════");
  console.log(`✅ Thành công : ${success} file`);
  if (failed.length > 0)
  console.log(`❌ Thất bại  : ${failed.length} file`);
  console.log("════════════════════════════════════════");
  if (success > 0) {
  console.log("🎉 URL không đổi — không cần sửa code hay database.");
  console.log(`💡 Backup gốc lưu tại Cloudinary folder: ${BACKUP_FOLDER}`);
  }
}

main().catch((err) => {
  console.error("💥 Script crash:", err.message);
  process.exit(1);
});
