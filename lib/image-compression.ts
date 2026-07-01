import imageCompression from "browser-image-compression";

/**
 * Default compression options. Images are converted to WebP for a much smaller
 * footprint while keeping good visual quality, and capped at 1920px / ~1MB.
 */
const DEFAULT_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  fileType: "image/webp" as const,
};

/** Replace any extension with .webp (keeps the original base name). */
function toWebpName(name: string): string {
  const base = name.replace(/\.[^/.]+$/, "");
  return `${base || "imagen"}.webp`;
}

/**
 * Compress an image and convert it to WebP. Non-image files (e.g. PDFs) are
 * returned untouched so this is safe to call on any uploaded file. On failure
 * the original file is returned so uploads never break.
 */
export async function compressImage(file: File, options = DEFAULT_OPTIONS): Promise<File> {
  // Only process raster images; leave SVG/PDF/other files as-is.
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    return file;
  }

  try {
    const compressed = await imageCompression(file, options);
    const targetType = options.fileType ?? compressed.type;
    // browser-image-compression keeps the original filename; rename to .webp
    // so Strapi stores the right extension/mime.
    return new File([compressed], toWebpName(file.name), {
      type: targetType,
      lastModified: Date.now(),
    });
  } catch (error) {
    console.error("Error comprimiendo imagen:", error);
    // Fallback: return the original file if compression fails.
    return file;
  }
}

export async function compressImages(files: File[], options = DEFAULT_OPTIONS): Promise<File[]> {
  return Promise.all(files.map((file) => compressImage(file, options)));
}

/**
 * Optimizes a PDF by reloading it and re-saving with object streams, which
 * deduplicates structure and usually reduces file size. pdf-lib is imported
 * dynamically so it is only bundled/loaded when a PDF is actually optimized.
 * Returns the original file if optimization fails or does not shrink it.
 */
export async function compressPdf(file: File): Promise<File> {
  if (file.type !== "application/pdf") return file;
  try {
    const { PDFDocument } = await import("pdf-lib");
    const bytes = await file.arrayBuffer();
    const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
    const saved = await pdf.save({ useObjectStreams: true });
    // Only keep the re-saved version when it is actually smaller.
    if (saved.byteLength > 0 && saved.byteLength < file.size) {
      return new File([saved as BlobPart], file.name, {
        type: "application/pdf",
        lastModified: Date.now(),
      });
    }
    return file;
  } catch (error) {
    console.error("Error optimizando PDF:", error);
    return file;
  }
}

/**
 * Single entry point used by all upload flows: converts images to WebP and
 * optimizes PDFs, leaving any other file type untouched. Always resolves to a
 * `File` (never throws), so uploads never break.
 */
export async function optimizeUpload(file: File): Promise<File> {
  if (file.type === "application/pdf") return compressPdf(file);
  return compressImage(file);
}
