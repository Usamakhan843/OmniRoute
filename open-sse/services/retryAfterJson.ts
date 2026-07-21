type JsonRecord = Record<string, unknown>;

function objectRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function positiveCappedMs(value: unknown, maxMs: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.min(value, maxMs)
    : null;
}

function futureTimestampMs(value: unknown, maxMs: number): number | null {
  if (typeof value !== "string") return null;
  const parsedTs = Date.parse(value);
  if (!Number.isFinite(parsedTs)) return null;
  const waitMs = parsedTs - Date.now();
  return waitMs > 0 ? Math.min(waitMs, maxMs) : null;
}

/**
 * Parse a Go-style duration string (e.g. "26s", "33s", "500ms", "1.5s", "5m30s") to ms.
 * Returns null if unparseable.
 */
function parseGoDuration(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const str = value.trim();
  if (!str) return null;

  // Reject negative durations — no legitimate retryDelay from Google Gemini or
  // any other provider would be negative.
  if (str.startsWith("-")) return null;

  let totalMs = 0;
  let remaining = str;

  // Match components in order: xms, xh, xm, xs
  const componentRe = /^(\d+(?:\.\d+)?)(ms|h|m|s)/;
  let matched = false;

  while (remaining.length > 0) {
    const match = remaining.match(componentRe);
    if (!match) return null;
    matched = true;
    const num = parseFloat(match[1]);
    const unit = match[2];
    remaining = remaining.slice(match[0].length);

    switch (unit) {
      case "h":
        totalMs += num * 3600000;
        break;
      case "m":
        totalMs += num * 60000;
        break;
      case "s":
        totalMs += num * 1000;
        break;
      case "ms":
        totalMs += num;
        break;
    }
  }

  if (!matched) return null;
  if (totalMs <= 0) return null;

  return totalMs;
}

/**
 * Parse Retry-After hints from a 429 JSON response body. Providers use both
 * top-level and nested `error` fields for ISO timestamps and millisecond values.
 * Also parses Google Gemini `retryDelay` from error.details[].retryDelay.
 */
export function parseRetryHintFromJsonBody(body: string, maxMs: number): number | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }

  const root = objectRecord(parsed);
  if (!Object.keys(root).length) return null;
  const errorObj = objectRecord(root.error);

  const isoHint = futureTimestampMs(errorObj.retryAfter ?? root.retryAfter, maxMs);
  if (isoHint !== null) return isoHint;

  // Parse Google Gemini retryDelay from error.details[].retryDelay
  const details = Array.isArray(errorObj.details) ? errorObj.details : [];
  for (const detail of details) {
    if (detail && typeof detail === "object") {
      const delay = parseGoDuration((detail as JsonRecord).retryDelay);
      if (delay !== null && delay > 0 && delay <= maxMs) return delay;
    }
  }

  return positiveCappedMs(
    errorObj.retry_after_ms ?? root.retry_after_ms ?? errorObj.retryAfterMs ?? root.retryAfterMs,
    maxMs
  );
}
