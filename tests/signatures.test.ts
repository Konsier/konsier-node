import {
  createKonsierSignature,
  verifyKonsierSignature,
} from "../src/protocol/signatures";

describe("signatures", () => {
  it("verifies a valid signature", () => {
    const apiKey = "k_test_123";
    const timestamp = Date.now().toString();
    const payload = JSON.stringify({ type: "tool_call" });
    const signature = createKonsierSignature({ apiKey, timestamp, payload });

    const result = verifyKonsierSignature({
      apiKey,
      timestamp,
      payload,
      providedSignature: `sha256=${signature}`,
    });

    expect(result).toEqual({ ok: true });
  });

  it("rejects expired timestamps", () => {
    const apiKey = "k_test_123";
    const nowMs = Date.now();
    const timestamp = String(nowMs - 10 * 60 * 1000);
    const payload = JSON.stringify({ type: "tool_call" });
    const signature = createKonsierSignature({ apiKey, timestamp, payload });

    const result = verifyKonsierSignature({
      apiKey,
      timestamp,
      payload,
      providedSignature: signature,
      nowMs,
      allowedClockSkewMs: 60_000,
    });

    expect(result).toEqual({ ok: false, reason: "TIMESTAMP_OUT_OF_RANGE" });
  });
});
