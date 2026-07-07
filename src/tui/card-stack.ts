import { Buffer2D, CellAttr } from "./buffer.js";
import { Card } from "./card.js";
import { MenuCard } from "./menu-card.js";
import { ActivityLog } from "./activity-log.js";
import { bottomBar, separatorLine, topBar } from "./status-bar.js";
import { Logger } from "../logger.js";

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
  private logExpanded: boolean = false;
  private status: StatusProvider;
  private sessionStart: number = Date.now();
  private lastMessageTime: number = Date.now();
  private width: number = 80;
  private height: number = 25;

  constructor(root: MenuCard, activityLog: ActivityLog, status: StatusProvider) {
    this.root = root;
    this.activityLog = activityLog;
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
    return this.stack.length > 0 ? this.stack[this.stack.length - 1]! : this.root;
  }

  public handleKey(key: string): void {
    if (this.logExpanded) {
      if (key === 'escape') {
        this.logExpanded = false;
        this.layout(this.width, this.height);
      } else {
        this.activityLog.handleKey(key);
      }
      return;
    }

    const top = this.topCard();
    const editing = top instanceof MenuCard && top.isEditing();
    if (!editing && (key === 'l' || key === 'L')) {
      this.logExpanded = true;
      this.activityLog.resetScroll();
      this.layout(this.width, this.height);
      return;
    }

    top.handleKey(key);
  }

  public layout(width: number, height: number): void {
    this.width = width;
    this.height = height;

    const mainY = 2;
    const bottomSeparatorY = height - 2;
    const availableHeight = Math.max(0, bottomSeparatorY - mainY);
    const activityLogHeight = this.logExpanded
      ? availableHeight
      : Math.max(ACTIVITY_LOG_MIN_HEIGHT, Math.round(availableHeight * ACTIVITY_LOG_RATIO));
    const activityLogY = this.logExpanded ? mainY : bottomSeparatorY - activityLogHeight;

    this.root.x = 1;
    this.root.y = mainY;
    this.root.width = Math.max(10, width - ROOT_RIGHT_MARGIN);
    this.root.height = Math.max(3, activityLogY - mainY);

    let parent: Card = this.root;
    for (const card of this.stack) {
      card.x = parent.x + CASCADE_INSET;
      card.y = parent.y + CASCADE_INSET;
      card.width = Math.max(10, parent.width - CASCADE_INSET);
      card.height = Math.max(3, activityLogY - card.y);
      parent = card;
    }

    this.activityLog.resize(1, activityLogY, Math.max(10, width - ROOT_RIGHT_MARGIN), Math.max(3, activityLogHeight));
  }

  public render(): Buffer2D {
    const buf = new Buffer2D(this.width, this.height);

    buf.writeText(
      0,
      0,
      topBar(this.width, this.status.isConnected(), this.status.getPort(), this.status.getMachineIdentity()),
      CellAttr.Header,
    );
    buf.writeText(0, 1, separatorLine(this.width), CellAttr.Border);

    if (!this.logExpanded) {
      // The root/base card never gets the connected-corner treatment — only a card
      // cascaded on top of another one does.
      this.root.render(buf, this.stack.length === 0, false);
      this.stack.forEach((card, index) => {
        card.render(buf, index === this.stack.length - 1);
      });
    }

    this.activityLog.render(buf);

    buf.writeText(0, this.height - 2, separatorLine(this.width), CellAttr.Border);
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
