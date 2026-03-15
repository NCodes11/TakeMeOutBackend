const now = () => globalThis.performance?.now?.() ?? Date.now();

export const perfNow = () => now();

export const logPerf = (label: string, start: number, meta?: Record<string, unknown>) => {
  if (!__DEV__) return;

  const durationMs = Math.round((now() - start) * 10) / 10;
  console.log(`[perf] ${label}`, {
    durationMs,
    ...(meta || {}),
  });
};
