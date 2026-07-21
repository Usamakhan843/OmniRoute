import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseRetryHintFromJsonBody } from "../../open-sse/services/retryAfterJson.ts";

describe("parseRetryHintFromJsonBody — Google Gemini retryDelay", () => {
  it("extracts retryDelay: '26s' from error.details[0].retryDelay", () => {
    const body = JSON.stringify({
      error: {
        details: [{ retryDelay: "26s" }],
      },
    });
    const result = parseRetryHintFromJsonBody(body, 300_000);
    assert.strictEqual(result, 26_000);
  });

  it("extracts retryDelay: '33s' from error.details[0].retryDelay", () => {
    const body = JSON.stringify({
      error: {
        details: [{ retryDelay: "33s" }],
      },
    });
    const result = parseRetryHintFromJsonBody(body, 300_000);
    assert.strictEqual(result, 33_000);
  });

  it("returns null for body without retryDelay", () => {
    const body = JSON.stringify({
      error: {
        message: "rate limit exceeded",
      },
    });
    const result = parseRetryHintFromJsonBody(body, 300_000);
    assert.strictEqual(result, null);
  });

  it("returns null for invalid body (non-JSON)", () => {
    const result = parseRetryHintFromJsonBody("not json", 300_000);
    assert.strictEqual(result, null);
  });

  it("returns null for empty body", () => {
    const result = parseRetryHintFromJsonBody("{}", 300_000);
    assert.strictEqual(result, null);
  });

  it("respects maxMs cap when retryDelay exceeds it", () => {
    const body = JSON.stringify({
      error: {
        details: [{ retryDelay: "600s" }],
      },
    });
    const result = parseRetryHintFromJsonBody(body, 60_000);
    assert.strictEqual(result, null);
  });

  it("parses retryDelay within maxMs boundary", () => {
    const body = JSON.stringify({
      error: {
        details: [{ retryDelay: "45s" }],
      },
    });
    const result = parseRetryHintFromJsonBody(body, 60_000);
    assert.strictEqual(result, 45_000);
  });

  it("parses retryDelay with compound Go duration '1m30s'", () => {
    const body = JSON.stringify({
      error: {
        details: [{ retryDelay: "1m30s" }],
      },
    });
    const result = parseRetryHintFromJsonBody(body, 300_000);
    assert.strictEqual(result, 90_000);
  });

  it("parses retryDelay with millisecond precision '500ms'", () => {
    const body = JSON.stringify({
      error: {
        details: [{ retryDelay: "500ms" }],
      },
    });
    const result = parseRetryHintFromJsonBody(body, 60_000);
    assert.strictEqual(result, 500);
  });
});
