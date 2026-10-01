import { shuffled, type RandomSource } from "./generate-packages";

export const LAYOUT_STAGES = [
  "PRE",
  "POST",
  "REMEDIAL_1",
  "REMEDIAL_2",
  "REMEDIAL_3",
] as const;

export type LayoutStage = (typeof LAYOUT_STAGES)[number];
export type BatchLayout = {
  stage: LayoutStage;
  questionOrder: string[];
  optionOrders: Record<string, Array<"A" | "B" | "C" | "D">>;
};

function sameOrder(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function differentOrder(
  values: readonly string[],
  previous: readonly string[] | null,
  random?: RandomSource,
): string[] {
  const result = shuffled(values, random);
  if (previous && result.length > 1 && sameOrder(result, previous)) {
    result.push(result.shift() as string);
  }
  return result;
}

export function generateBatchLayouts(
  questionIds: readonly string[],
  random?: RandomSource,
): BatchLayout[] {
  let previousOrder: string[] | null = null;

  return LAYOUT_STAGES.map((stage) => {
    const questionOrder = differentOrder(questionIds, previousOrder, random);
    previousOrder = questionOrder;
    const optionOrders = Object.fromEntries(
      questionIds.map((questionId) => [
        questionId,
        ["A", "B", "C", "D"],
      ]),
    ) as BatchLayout["optionOrders"];

    return { stage, questionOrder, optionOrders };
  });
}
