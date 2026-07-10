import { numberToHex } from "../convert.js";
import { Logger } from "../logger.js";
import type { TechStep } from "../techstep.js";
import { CellAttr } from "./buffer.js";
import { LogCard, type LogLine } from "./log-card.js";

const HISTORY_LENGTH = 8;

export class MonitorCard extends LogCard {
  private addresses: number[];
  private techstep: Pick<TechStep, "readMemory">;
  private onPop: () => void;
  private history: Map<number, number[]> = new Map();
  private changed: Set<number> = new Set();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private stopped: boolean = false;
  private busy: boolean = false;

  constructor(
    addresses: number[],
    intervalSeconds: number,
    techstep: Pick<TechStep, "readMemory">,
    onPop: () => void,
    x: number = 0,
    y: number = 0,
    width: number = 0,
    height: number = 0,
  ) {
    super("[=] Memory Monitor", x, y, width, height);
    this.addresses = addresses;
    this.techstep = techstep;
    this.onPop = onPop;
    for (const address of addresses) {
      this.history.set(address, []);
    }
    void this.poll(intervalSeconds * 1000);
  }

  private schedule(intervalMs: number): void {
    this.timer = setTimeout(() => {
      void this.poll(intervalMs);
    }, intervalMs);
  }

  private async poll(intervalMs: number): Promise<void> {
    if (this.busy) {
      // A previous poll is still running (e.g. a slow read); skip this tick
      // rather than overlapping with it or blocking the event loop waiting.
      if (!this.stopped) {
        this.schedule(intervalMs);
      }
      return;
    }
    this.busy = true;
    this.changed.clear();
    for (const address of this.addresses) {
      try {
        const [value] = await this.techstep.readMemory(address, 1);
        const history = this.history.get(address) ?? [];
        const previous = history[history.length - 1];
        if (previous !== undefined && previous !== value) {
          this.changed.add(address);
        }
        history.push(value);
        if (history.length > HISTORY_LENGTH) {
          history.shift();
        }
        this.history.set(address, history);
      } catch (e: unknown) {
        Logger.error(
          `Memory Monitor read of ${numberToHex(address, 8)} failed: ${Error.isError(e) ? e.message : ""}`,
        );
      }
    }
    Logger.log("Memory Monitor poll complete");
    if (!this.stopped) {
      this.schedule(intervalMs);
    }
    this.busy = false;
  }

  protected getBufferSource(): readonly LogLine[] {
    return this.addresses.map((address) => {
      const history = this.history.get(address) ?? [];
      const current = history[history.length - 1];
      const currentText =
        current === undefined ? "--" : numberToHex(current, 2);
      const historyText = history.map((v) => numberToHex(v, 2)).join(" ");
      const text = `${numberToHex(address, 8)} = ${currentText}  [${historyText}]`;
      return this.changed.has(address)
        ? { text, attr: CellAttr.Error }
        : { text };
    });
  }

  public handleKey(key: string): boolean {
    if (key === "escape") {
      this.stopped = true;
      clearTimeout(this.timer);
      this.onPop();
      return true;
    }
    return super.handleKey(key);
  }
}
