import { Logger } from "../logger.js";
import { ActivityLog } from "./activity-log.js";
import { Buffer2D, CellAttr } from "./buffer.js";
import { Card } from "./card.js";
import { EventLog } from "./event-log.js";
import { MenuCard } from "./menu-card.js";
import { bottomBar, separatorLine, topBar } from "./status-bar.js";

const ACTIVITY_LOG_MIN_HEIGHT = 5;
const ACTIVITY_LOG_RATIO = 0.3;
const CASCADE_INSET = 3;
const ROOT_RIGHT_MARGIN = 5;

export interface StatusProvider {
  isConnected(): boolean;
  getPort(): string;
  getLastStatus(): number;
  getLastError(): number;
  getMachineIdentity(): string | undefined;
}

export class CardStack {
  private root: MenuCard;
  private stack: Card[] = [];
  private activityLog: ActivityLog;
  private eventLog: EventLog;
  private activityLogExpanded: boolean = false;
  private eventLogExpanded: boolean = false;
  private status: StatusProvider;
  private sessionStart: number = Date.now();
  private lastMessageTime: number = Date.now();
  private width: number = 80;
  private height: number = 25;

  constructor(
    root: MenuCard,
    activityLog: ActivityLog,
    eventLog: EventLog,
    status: StatusProvider,
  ) {
    this.root = root;
    this.activityLog = activityLog;
    this.eventLog = eventLog;
    this.status = status;
    Logger.onAppend(() => {
      this.lastMessageTime = Date.now();
    });
  }

  public push(card: Card): void {
    this.stack.push(card);
    this.layout(this.width, this.height);
  }

  public pop(): void {
    this.stack.pop();
    this.layout(this.width, this.height);
  }

  private topCard(): Card {
    return this.stack.length > 0
      ? this.stack[this.stack.length - 1]
      : this.root;
  }

  public handleKey(key: string): void {
    if (this.activityLogExpanded) {
      if (key === "escape") {
        this.activityLogExpanded = false;
        this.layout(this.width, this.height);
      } else {
        this.activityLog.handleKey(key);
      }
      return;
    }

    const top = this.topCard();
    const editing = top instanceof MenuCard && top.isEditing();
    if (!editing && key === "+") {
      this.activityLogExpanded = true;
      this.activityLog.resetScroll();
      this.layout(this.width, this.height);
      return;
    }

    top.handleKey(key);
  }

  public layout(width: number, height: number): void {
    this.width = width;
    this.height = height;

    const mainX = 1;
    const mainY = 2;
    const bottomSeparatorY = height - 2;
    const eventLogX = 1;
    const eventLogWidth = this.activityLogExpanded
      ? width - 2
      : Math.floor(width * 0.33);
    const availableHeight = Math.max(0, bottomSeparatorY - mainY);
    const activityLogX = this.activityLogExpanded ? 1 : eventLogWidth + 2;
    const activityLogWidth = this.activityLogExpanded
      ? width - 2
      : Math.floor(width * 0.66) - 2;
    const logsHeight = this.activityLogExpanded
      ? availableHeight
      : Math.max(
          ACTIVITY_LOG_MIN_HEIGHT,
          Math.round(availableHeight * ACTIVITY_LOG_RATIO),
        );
    const logsY = this.activityLogExpanded
      ? mainY
      : bottomSeparatorY - logsHeight;

    this.root.x = mainX;
    this.root.y = mainY;
    this.root.width = Math.max(10, width - ROOT_RIGHT_MARGIN);
    this.root.height = Math.max(3, logsY - mainY);

    let parent: Card = this.root;
    for (const card of this.stack) {
      card.x = parent.x + CASCADE_INSET;
      card.y = parent.y + CASCADE_INSET;
      card.width = Math.max(10, parent.width - CASCADE_INSET);
      card.height = Math.max(3, logsY - card.y);
      parent = card;
    }

    this.eventLog.resize(
      eventLogX,
      logsY,
      eventLogWidth,
      Math.max(3, logsHeight),
    );

    this.activityLog.resize(
      activityLogX,
      logsY,
      activityLogWidth,
      Math.max(3, logsHeight),
    );
  }

  public render(): Buffer2D {
    const buf = new Buffer2D(this.width, this.height);

    buf.writeText(
      0,
      0,
      topBar(
        this.width,
        this.status.isConnected(),
        this.status.getPort(),
        this.status.getMachineIdentity(),
      ),
      CellAttr.Header,
    );
    buf.writeText(0, 1, separatorLine(this.width), CellAttr.Border);

    if (!this.activityLogExpanded && !this.eventLogExpanded) {
      this.root.render(buf, this.stack.length === 0);
      this.stack.forEach((card, index) => {
        card.render(buf, index === this.stack.length - 1);
      });
    }

    this.activityLog.render(buf, true);
    this.eventLog.render(buf, true);

    buf.writeText(
      0,
      this.height - 2,
      separatorLine(this.width),
      CellAttr.Border,
    );
    buf.writeText(
      0,
      this.height - 1,
      bottomBar(
        this.width,
        this.status.getLastStatus(),
        this.status.getLastError(),
        Date.now() - this.sessionStart,
        Date.now() - this.lastMessageTime,
      ),
      CellAttr.Header,
    );

    return buf;
  }
}
