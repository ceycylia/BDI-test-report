export const NORMAL_TEST_MINUTES = 7;
export const EXTRA_TEST_MINUTES = 1;
export const MAX_TEST_MINUTES = NORMAL_TEST_MINUTES + EXTRA_TEST_MINUTES;

export function attemptDeadlines(startedAt: string, normalMinutes = NORMAL_TEST_MINUTES) {
  const started = Date.parse(startedAt);
  return {
    normalDeadlineAt: new Date(started + normalMinutes * 60_000).toISOString(),
    hardDeadlineAt: new Date(started + (normalMinutes + EXTRA_TEST_MINUTES) * 60_000).toISOString(),
  };
}

