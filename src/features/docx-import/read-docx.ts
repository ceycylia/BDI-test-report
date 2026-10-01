import type { DocxBlock, ImportedImage, ParsedImportQuestion } from "./parser-core";
import { parseQuestionBlocks } from "./parser-core";

const MAX_DOCX_BYTES = 15 * 1024 * 1024;

function readImages(element: Element): ImportedImage[] {
  return Array.from(element.querySelectorAll("img"))
    .map((image) => {
      const source = image.getAttribute("src") ?? "";
      const match = /^data:([^;]+);base64,/u.exec(source);
      return match?.[1] ? { dataUrl: source, mimeType: match[1] } : null;
    })
    .filter((image): image is ImportedImage => image !== null);
}

export async function readDocxQuestions(file: File): Promise<{
  questions: ParsedImportQuestion[];
  warnings: string[];
}> {
  if (!file.name.toLowerCase().endsWith(".docx")) {
    throw new Error("Format berkas harus .docx.");
  }
  if (file.size === 0 || file.size > MAX_DOCX_BYTES) {
    throw new Error("Ukuran berkas Word maksimal 15 MB.");
  }

  const mammoth = await import("mammoth");
  const result = await mammoth.convertToHtml(
    { arrayBuffer: await file.arrayBuffer() },
    {
      convertImage: mammoth.images.imgElement(async (image) => ({
        src: `data:${image.contentType};base64,${await image.read("base64")}`,
      })),
    },
  );
  const document = new DOMParser().parseFromString(result.value, "text/html");
  const blocks: DocxBlock[] = Array.from(document.body.children).map((element) => ({
    text: element.textContent ?? "",
    images: readImages(element),
  }));

  return {
    questions: parseQuestionBlocks(blocks),
    warnings: result.messages.map((message) => message.message),
  };
}

export function imageDataUrlToFile(image: ImportedImage, index: number): File {
  const [, encoded = ""] = image.dataUrl.split(",", 2);
  const binary = atob(encoded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const extension = image.mimeType === "image/jpeg" ? "jpg" : image.mimeType.split("/")[1] ?? "png";
  return new File([bytes], `soal-${index}.${extension}`, { type: image.mimeType });
}
