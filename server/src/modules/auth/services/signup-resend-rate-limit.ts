const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 10;
const MAX_TRACKED_ADDRESSES = 10_000;

interface Window {
  startedAt: number;
  requestCount: number;
}

const windows = new Map<string, Window>();

export const allowSignupVerificationResend = (
  address: string,
  now = Date.now(),
): boolean => {
  for (const [trackedAddress, window] of windows) {
    if (now - window.startedAt >= WINDOW_MS) {
      windows.delete(trackedAddress);
    }
  }

  const current = windows.get(address);
  if (current && now - current.startedAt < WINDOW_MS) {
    if (current.requestCount >= MAX_REQUESTS_PER_WINDOW) {
      return false;
    }
    current.requestCount += 1;
    return true;
  }

  if (windows.size >= MAX_TRACKED_ADDRESSES) {
    const oldestAddress = windows.keys().next().value;
    if (oldestAddress !== undefined) {
      windows.delete(oldestAddress);
    }
  }

  windows.set(address, { startedAt: now, requestCount: 1 });
  return true;
};
