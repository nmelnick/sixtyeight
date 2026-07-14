import { describe, expect, it } from "vitest";
import type { SerialConnection } from "./serial.js";
import { TechStep } from "./techstep.js";

class FakeConnection {
  public written: string[] = [];
  private queue: string[] = [];
  private queuedError: { error: unknown } | null = null;
  private pendingResolve: ((line: string) => void) | null = null;
  private pendingReject: ((err: unknown) => void) | null = null;

  send(output: string): Promise<void> {
    this.written.push(output);
    return Promise.resolve();
  }

  async waitForResponse(): Promise<string> {
    if (this.queuedError) {
      const { error } = this.queuedError;
      this.queuedError = null;
      throw error;
    }
    if (this.queue.length > 0) {
      return this.queue.shift()!;
    }
    return new Promise((resolve, reject) => {
      this.pendingResolve = resolve;
      this.pendingReject = reject;
    });
  }

  respond(line: string): void {
    if (this.pendingResolve) {
      const resolve = this.pendingResolve;
      this.pendingResolve = null;
      this.pendingReject = null;
      resolve(line);
    } else {
      this.queue.push(line);
    }
  }

  fail(error: unknown): void {
    if (this.pendingReject) {
      const reject = this.pendingReject;
      this.pendingResolve = null;
      this.pendingReject = null;
      reject(error);
    } else {
      this.queuedError = { error };
    }
  }
}

function setup() {
  const connection = new FakeConnection();
  const techStep = new TechStep(connection as unknown as SerialConnection);
  return { connection, techStep };
}

describe("TechStep", () => {
  it("sends the version command and resolves when the device echoes it back", async () => {
    const { connection, techStep } = setup();

    const resultPromise = techStep.version();
    connection.respond("*V");

    await expect(resultPromise).resolves.toBeUndefined();
    expect(connection.written).toEqual(["*V"]);
  });

  it("resolves with the device reply when it differs from the echoed command", async () => {
    const { connection, techStep } = setup();

    const resultPromise = techStep.version();
    connection.respond("v1.2.3");

    await expect(resultPromise).resolves.toBe("v1.2.3");
  });

  it("sends the return status command and returns the parsed status and error", async () => {
    const { connection, techStep } = setup();

    const resultPromise = techStep.getReturnStatus();
    connection.respond("0000000C0000");

    await expect(resultPromise).resolves.toEqual([12, 0]);
    expect(connection.written).toEqual(["*R"]);
  });

  it("returns NaN status/error from getReturnStatus when the command only echoes", async () => {
    const { connection, techStep } = setup();

    const resultPromise = techStep.getReturnStatus();
    connection.respond("*R");

    await expect(resultPromise).resolves.toEqual([NaN, NaN]);
  });

  it("rejects when the connection fails while waiting for a response", async () => {
    const { connection, techStep } = setup();

    const resultPromise = techStep.version();
    const error = new Error("boom");
    connection.fail(error);

    await expect(resultPromise).rejects.toBe(error);
  });

  it("reads memory and parses the response into bytes", async () => {
    const { connection, techStep } = setup();

    const resultPromise = techStep.readMemory(0x1000, 2);
    connection.respond("*L");
    connection.respond("*B");
    connection.respond("0AFF");
    connection.respond("*M");

    await expect(resultPromise).resolves.toEqual([0x0a, 0xff]);
  });

  it("rejects and stops waiting when an ERROR line arrives mid-dump", async () => {
    const { connection, techStep } = setup();

    const resultPromise = techStep.readMemory(0x1000, 8);
    connection.respond("*L");
    connection.respond("*B");
    connection.respond("0A0B0C0D");
    connection.respond("*ERROR*");

    await expect(resultPromise).rejects.toThrow("*ERROR*");
    connection.respond("*V");
    await expect(techStep.version()).resolves.toBeUndefined();
  });

  it("requests the byte count as a zero-padded four-digit hex word", async () => {
    const { connection, techStep } = setup();

    const resultPromise = techStep.readMemory(0x1000, 32);
    connection.respond("*L");
    connection.respond("*B");
    for (let i = 0; i < 8; i++) {
      connection.respond("0A".repeat(4));
    }
    connection.respond("*M");

    await expect(resultPromise).resolves.toEqual(new Array(32).fill(0x0a));
    expect(connection.written).toEqual(["*L00001000", "*B0020", "*M"]);
  });

  it("parses a multi-line 32-byte memory dump, stopping at the *M terminator", async () => {
    const { connection, techStep } = setup();

    const bytes = Array.from({ length: 32 }, (_, i) => i);
    const lines: string[] = [];
    for (let i = 0; i < bytes.length; i += 4) {
      const hex = bytes
        .slice(i, i + 4)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      lines.push(hex);
    }

    const resultPromise = techStep.readMemory(0x1000, 32);
    connection.respond("*L");
    connection.respond("*B");
    for (const line of lines) {
      connection.respond(line);
    }
    connection.respond("*M");

    await expect(resultPromise).resolves.toEqual(bytes);
  });

  it("rejects when the memory dump response is malformed", async () => {
    const { connection, techStep } = setup();

    const resultPromise = techStep.readMemory(0x1000, 2);
    connection.respond("*L");
    connection.respond("*B");
    connection.respond("garbage");
    connection.respond("*M");

    await expect(resultPromise).rejects.toThrow(
      /Unexpected memory dump response/,
    );
  });

  it("rejects when the memory dump response has the wrong byte count", async () => {
    const { connection, techStep } = setup();

    const resultPromise = techStep.readMemory(0x1000, 2);
    connection.respond("*L");
    connection.respond("*B");
    connection.respond("0A");
    connection.respond("*M");

    await expect(resultPromise).rejects.toThrow(
      /Unexpected memory dump response/,
    );
  });
});
