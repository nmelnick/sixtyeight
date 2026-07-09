import { Eventer } from "../eventer.js";
import { CellAttr } from "./buffer.js";
import { LogCard, type LogLine } from "./log-card.js";

export class EventLog extends LogCard {
  constructor(x: number, y: number, width: number, height: number) {
    super("[-] Event Log", x, y, width, height);
  }

  protected getBufferSource(): readonly LogLine[] {
    return Eventer.getEvents().map((event) => {
      const prefix = event.status === "Success" ? "✓" : "X";
      return {
        text: `${prefix} ${event.name} = ${event.result}`,
        attr: event.status === "Success" ? CellAttr.Success : CellAttr.Error,
      };
    });
  }
}
