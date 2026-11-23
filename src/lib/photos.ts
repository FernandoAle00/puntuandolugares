import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB

interface DetectedImage {
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/avif";
  ext: "jpg" | "png" | "webp" | "avif";
}

/**
 * Inspects binary magic bytes to verify the uploaded file is genuinely an allowed image format.
 */
export function detectImageFormat(buf: Buffer): DetectedImage | null {
  if (buf.length < 12) return null;

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mimeType: "image/jpeg", ext: "jpg" };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return { mimeType: "image/png", ext: "png" };
  }

  // WebP: RIFF....WEBP
  if (
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { mimeType: "image/webp", ext: "webp" };
  }

  // AVIF: ....ftypavif / ftypmif1
  if (buf.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buf.subarray(8, 12).toString("ascii");
    if (brand === "avif" || brand === "avis" || brand === "mif1") {
      return { mimeType: "image/avif", ext: "avif" };
    }
  }

  return null;
}

export function getUploadsDir(): string {
  return path.resolve(process.cwd(), process.env.UPLOADS_DIR || "data/uploads");
}

export async function savePhotoBuffer(
  buf: Buffer,
  ext: DetectedImage["ext"],
): Promise<string> {
  const dir = getUploadsDir();
  await fs.mkdir(dir, { recursive: true });
  const filename = `${crypto.randomUUID()}.${ext}`;
  const fullPath = path.join(dir, filename);
  await fs.writeFile(fullPath, buf);
  return filename;
}

export async function readPhotoBuffer(filename: string): Promise<Buffer | null> {
  // Reject any path separator to prevent traversal
  if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
    return null;
  }
  const fullPath = path.join(getUploadsDir(), filename);
  try {
    return await fs.readFile(fullPath);
  } catch {
    return null;
  }
}

export async function removePhotoFile(filename: string): Promise<void> {
  if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
    return;
  }
  const fullPath = path.join(getUploadsDir(), filename);
  try {
    await fs.unlink(fullPath);
  } catch {
    // Ignore missing file on disk
  }
}
