export type ImportedImage = {
  dataUrl: string;
  mimeType: string;
};

export type DocxBlock = {
  text: string;
  images: ImportedImage[];
};

export type ParsedImportQuestion = {
  sourceNumber: number | null;
  questionText: string;
  image: ImportedImage | null;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOptionKey: "A" | "B" | "C" | "D" | null;
  errors: string[];
};

type MutableQuestion = ParsedImportQuestion & {
  questionParts: string[];
  images: ImportedImage[];
};

type ActiveSection = "QUESTION" | "A" | "B" | "C" | "D" | null;

function cleanText(value: string): string {
  return value.replaceAll("\u0000", "").replace(/\s+/gu, " ").trim();
}

function createQuestion(sourceNumber: number | null): MutableQuestion {
  return {
    sourceNumber,
    questionText: "",
    image: null,
    optionA: "",
    optionB: "",
    optionC: "",
    optionD: "",
    correctOptionKey: null,
    errors: [],
    questionParts: [],
    images: [],
  };
}

function finalizeQuestion(question: MutableQuestion): ParsedImportQuestion {
  question.questionText = cleanText(question.questionParts.join("\n"));
  question.image = question.images[0] ?? null;

  if (!question.questionText) question.errors.push("Pertanyaan kosong.");
  if (!question.optionA) question.errors.push("Pilihan A tidak ditemukan.");
  if (!question.optionB) question.errors.push("Pilihan B tidak ditemukan.");
  if (!question.optionC) question.errors.push("Pilihan C tidak ditemukan.");
  if (!question.optionD) question.errors.push("Pilihan D tidak ditemukan.");
  if (!question.correctOptionKey) question.errors.push("Kunci jawaban kosong atau bukan A-D.");
  if (question.images.length > 1) question.errors.push("Satu soal hanya boleh mempunyai satu gambar.");

  const { questionParts: _questionParts, images: _images, ...result } = question;
  return result;
}

export function parseQuestionBlocks(blocks: DocxBlock[]): ParsedImportQuestion[] {
  const questions: ParsedImportQuestion[] = [];
  const usedNumbers = new Set<number>();
  let current: MutableQuestion | null = null;
  let section: ActiveSection = null;

  const finishCurrent = () => {
    if (current) questions.push(finalizeQuestion(current));
    current = null;
    section = null;
  };

  for (const block of blocks) {
    const text = cleanText(block.text);
    const numberMatch = /^SOAL\s+(\d+)$/iu.exec(text);

    if (numberMatch) {
      finishCurrent();
      const sourceNumber = Number(numberMatch[1]);
      current = createQuestion(sourceNumber);
      if (usedNumbers.has(sourceNumber)) {
        current.errors.push(`Nomor soal ${sourceNumber} digunakan lebih dari sekali.`);
      }
      usedNumbers.add(sourceNumber);
      continue;
    }

    if (!current) continue;

    if (block.images.length > 0) {
      if (section !== "QUESTION" || current.optionA) {
        current.errors.push("Gambar hanya boleh berada pada bagian pertanyaan.");
      } else {
        current.images.push(...block.images);
      }
    }

    if (!text) continue;
    if (/^PERTANYAAN\s*:$/iu.test(text)) {
      section = "QUESTION";
      continue;
    }

    const optionMatch = /^([ABCD])[.)]\s*(.*)$/iu.exec(text);
    if (optionMatch) {
      const key = optionMatch[1]?.toUpperCase() as Exclude<ActiveSection, "QUESTION" | null>;
      const value = cleanText(optionMatch[2] ?? "");
      const property = `option${key}` as "optionA" | "optionB" | "optionC" | "optionD";
      if (current[property]) current.errors.push(`Pilihan ${key} ditemukan lebih dari sekali.`);
      current[property] = value;
      section = key;
      continue;
    }

    const keyMatch = /^KUNCI\s*:\s*([A-D])$/iu.exec(text);
    if (keyMatch) {
      current.correctOptionKey = keyMatch[1]?.toUpperCase() as "A" | "B" | "C" | "D";
      section = null;
      continue;
    }

    if (section === "QUESTION") {
      current.questionParts.push(text);
      continue;
    }
    if (section) {
      const property = `option${section}` as "optionA" | "optionB" | "optionC" | "optionD";
      current[property] = cleanText(`${current[property]} ${text}`);
      continue;
    }

    current.errors.push(`Format blok tidak dikenali: “${text.slice(0, 80)}”.`);
  }

  finishCurrent();
  return questions;
}
