import { LogCard } from "./log-card.js";

export class EventLog extends LogCard {
  constructor(x: number, y: number, width: number, height: number) {
    super("[-] Event Log", x, y, width, height);
  }

  protected getBufferSource(): readonly string[] {
    return [];
  }
}
