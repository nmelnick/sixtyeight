import { describe, expect, it } from "vitest";
import { TechStep } from "./techstep.js";
import type { SerialConnection } from "./serial.js";

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
});
