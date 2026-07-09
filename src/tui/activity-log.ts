import { Logger } from "../logger.js";
import { LogCard, type LogLine } from "./log-card.js";

export class ActivityLog extends LogCard {
  constructor(x: number, y: number, width: number, height: number) {
    super("[+] Activity Log", x, y, width, height);
  }

  protected getBufferSource(): readonly LogLine[] {
    return Logger.getLines().map((text) => ({ text }));
  }
}
