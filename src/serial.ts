import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";
import { Config } from "./config.js";
import { Logger } from "./logger.js";
import EventEmitter from "node:events";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const LINE_DELAY_MS = 160;
const CHAR_DELAY_MS = 7;

export class SerialConnection {
  private serialPort: SerialPort;
  private locked: boolean = false;
  private responseQueue: string[] = [];
  private arrayEmitter = new EventEmitter();

  constructor() {
    this.serialPort = new SerialPort({
      path: Config.serialPort,
      baudRate: 9600,
      stopBits: 2,
    });
    this.serialPort.on("data", (data: Buffer) => {
      if (data[0] === "?".charCodeAt(0)) {
        this.responseQueue.push(data.toString());
        this.arrayEmitter.emit("queued-line");
      }
    });
    this.serialPort.on("error", (error) => {
      Logger.error(`${error}`);
    });
    const asLines = this.serialPort.pipe(
      new ReadlineParser({ delimiter: "\r\n" }),
    );
    asLines.on("data", (line: string) => {
      this.responseQueue.push(line);
      this.arrayEmitter.emit("queued-line");
    });
    this.arrayEmitter.on("queued-line", () => {
      Logger.log(`Received: "${this.responseQueue[0].replace(/[\r\n]/g, "")}"`);
    });
  }

  public lock() {
    this.locked = true;
  }

  public unlock() {
    this.locked = false;
  }

  public async send(output: string): Promise<void> {
    while (this.locked) {
      Logger.log("waiting");
      await sleep(10);
    }
    this.lock();
    await sleep(LINE_DELAY_MS);
    Logger.log(`Writing: "${output.replace(/[\r\n]/g, "")}"`);
    for (const c of output.split("")) {
      this.serialPort.write(c);
      await sleep(CHAR_DELAY_MS);
    }
    this.unlock();
  }

  public async waitForResponse(): Promise<string> {
    this.lock();
    if (this.responseQueue.length > 0) {
      this.unlock();
      return this.responseQueue.shift() || "";
    }

    return new Promise((resolve, reject) => {
      let answered = false;
      const onQueued = () => {
        answered = true;
        this.unlock();
        resolve(this.responseQueue.shift() || "");
      };
      this.arrayEmitter.once("queued-line", onQueued);

      void (async () => {
        // Reject with a timeout if we hit 60s without a response
        for (let i = 0; i < 60; i++) {
          await sleep(1000);
          if (answered) {
            return;
          }
        }
        this.arrayEmitter.removeListener("queued-line", onQueued);
        this.unlock();
        reject(new Error("Timeout"));
      })();
    });
  }
}
