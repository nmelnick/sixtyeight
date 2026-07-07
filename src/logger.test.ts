import { describe, expect, it, vi, beforeEach } from "vitest";
import { Logger } from "./logger.js";

describe("Logger", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 16, 41));
  });

  it("formats appended lines with an [HH:MM] timestamp prefix", () => {
    Logger.log('Sending: "*A"');
    const lines = Logger.getLines();
    expect(lines[lines.length - 1]).toBe('[16:41] Sending: "*A"');
  });

  it("prefixes error messages with Error:", () => {
    Logger.error("boom");
    const lines = Logger.getLines();
    expect(lines[lines.length - 1]).toBe("[16:41] Error: boom");
  });

  it("notifies subscribers on append", () => {
    const cb = vi.fn();
    Logger.onAppend(cb);
    Logger.log("hello");
    expect(cb).toHaveBeenCalledWith("[16:41] hello");
  });
});
