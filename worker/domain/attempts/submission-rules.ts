export function evaluateSubmission(
  questionIds: readonly string[],
  answers: Readonly<Record<string, string>>,
  hardDeadlineAt: string,
  mode: "NORMAL" | "TIMEOUT",
  now = new Date(),
) {
  const timedOut = now.getTime() >= Date.parse(hardDeadlineAt);
  const missingQuestionIds = questionIds.filter((id) => !answers[id]);
  return {
    timedOut,
    missingQuestionIds,
    allowed: timedOut || (mode === "NORMAL" && missingQuestionIds.length === 0),
  };
}

export function fillMissingAnswers(
  questionIds: readonly string[],
  answers: Readonly<Record<string, "A" | "B" | "C" | "D">>,
  fallback: "A" | "B" | "C" | "D" = "C",
) {
  const completed = { ...answers };
  for (const questionId of questionIds) if (!completed[questionId]) completed[questionId] = fallback;
  return completed;
}
