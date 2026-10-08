export async function optimizeImage(file: File, maxWidth = 600, maxHeight = 800, quality = 0.82): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= 700_000) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    if (!blob) return file;
    return new File([blob], `${file.name.replace(/\.[^.]+$/u, "")}.webp`, { type: "image/webp", lastModified: Date.now() });
  } catch {
    return file;
  }
}
