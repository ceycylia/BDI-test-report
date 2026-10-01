export function calculateScore(correctCount: number, totalQuestions: number): number {
  if (!Number.isInteger(totalQuestions) || totalQuestions <= 0) throw new Error("Jumlah soal harus positif.");
  if (!Number.isInteger(correctCount) || correctCount < 0 || correctCount > totalQuestions) throw new Error("Jumlah jawaban benar tidak valid.");
  return Math.round((correctCount / totalQuestions) * 10_000) / 100;
}
