export type QuestionUsage = {
  id: string;
  timesAssigned: number;
};

export type BatchPackage = {
  batchId: string;
  questionIds: string[];
};

export type RandomSource = () => number;

function secureRandom(): number {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return (value[0] ?? 0) / 0x1_0000_0000;
}

export function shuffled<T>(items: readonly T[], random: RandomSource = secureRandom): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex] as T, result[index] as T];
  }
  return result;
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((id) => rightSet.has(id));
}

export function allocateQuestionPackages(
  questions: readonly QuestionUsage[],
  batchIds: readonly string[],
  questionCount: number,
  random: RandomSource = secureRandom,
): BatchPackage[] {
  if (!Number.isInteger(questionCount) || questionCount <= 0) {
    throw new Error("Jumlah soal harus berupa integer positif.");
  }
  if (questions.length < questionCount) {
    throw new Error("Jumlah soal aktif tidak mencukupi untuk satu paket.");
  }

  const usage = new Map(questions.map((question) => [question.id, question.timesAssigned]));
  const packages: BatchPackage[] = [];

  for (const batchId of batchIds) {
    const byUsage = new Map<number, string[]>();
    for (const question of questions) {
      const count = usage.get(question.id) ?? 0;
      const group = byUsage.get(count) ?? [];
      group.push(question.id);
      byUsage.set(count, group);
    }

    const candidates = [...byUsage.entries()]
      .sort(([left], [right]) => left - right)
      .flatMap(([, ids]) => shuffled(ids, random));
    const selected = candidates.slice(0, questionCount);

    const duplicatesPrevious = packages.some((item) => sameSet(item.questionIds, selected));
    if (duplicatesPrevious && candidates.length > questionCount) {
      const selectedLast = selected.at(-1);
      const replacement = candidates
        .slice(questionCount)
        .find((id) => usage.get(id) === (selectedLast ? usage.get(selectedLast) : undefined));
      if (replacement) selected[selected.length - 1] = replacement;
    }

    for (const id of selected) usage.set(id, (usage.get(id) ?? 0) + 1);
    packages.push({ batchId, questionIds: selected });
  }

  return packages;
}
