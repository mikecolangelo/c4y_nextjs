import imageCompression from "browser-image-compression";

const DEFAULT_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
};

export async function compressImage(file: File, options = DEFAULT_OPTIONS): Promise<File> {
  try {
    const compressedFile = await imageCompression(file, options);
    return compressedFile;
  } catch (error) {
    console.error("Error comprimiendo imagen:", error);
    // Fallback: retornar archivo original si falla la compresión
    return file;
  }
}

export async function compressImages(files: File[], options = DEFAULT_OPTIONS): Promise<File[]> {
  return Promise.all(files.map((file) => compressImage(file, options)));
}
