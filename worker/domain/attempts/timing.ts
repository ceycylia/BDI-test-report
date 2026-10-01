export const NORMAL_TEST_MINUTES = 15;
export const EXTRA_TEST_MINUTES = 5;
export const MAX_TEST_MINUTES = NORMAL_TEST_MINUTES + EXTRA_TEST_MINUTES;

export function attemptDeadlines(startedAt: string) {
  const started = Date.parse(startedAt);
  return {
    normalDeadlineAt: new Date(started + NORMAL_TEST_MINUTES * 60_000).toISOString(),
    hardDeadlineAt: new Date(started + MAX_TEST_MINUTES * 60_000).toISOString(),
  };
}

