import { shuffled, type RandomSource } from "../allocation/generate-packages";

const FIXED_OPTION_ORDER = ["A", "B", "C", "D"] as const;

export function personalizeQuestionOrder<
  T extends { position: number; optionOrder: Array<"A" | "B" | "C" | "D"> },
>(questions: readonly T[], random?: RandomSource): T[] {
  return shuffled(questions, random).map((question, index) => ({
    ...question,
    position: index + 1,
    optionOrder: [...FIXED_OPTION_ORDER],
  }));
}
