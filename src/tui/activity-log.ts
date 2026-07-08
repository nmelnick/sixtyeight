import { Logger } from "../logger.js";
import { Buffer2D } from "./buffer.js";
import { LogCard } from "./log-card.js";

export class ActivityLog extends LogCard {
  constructor(x: number, y: number, width: number, height: number) {
    super("[+] Activity Log", x, y, width, height);
  }

  protected getBufferSource(): readonly string[] {
    return Logger.getLines();
  }
}
