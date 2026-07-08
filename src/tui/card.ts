import { Buffer2D, CellAttr } from "./buffer.js";

export abstract class Card {
  public title: string;
  public x: number;
  public y: number;
  public width: number;
  public height: number;
  public parent?: Card;

  constructor(
    title: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    this.title = title;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  /**
   * Draws the FileCard chrome (tab + border) at this card's position, then delegates
   * to renderContent.
   *
   * @param active Pass `false` for a card sitting behind an open submenu so its
   *   border dims instead of competing with the foreground card.
   * @param connectCorners Whether the upper corners connect down to the lower ones
   *   (only makes sense for a card cascaded on top of another — the root/base card
   *   never gets this treatment, even while active). Defaults to `active`.
   */
  public render(
    buf: Buffer2D,
    active: boolean = true,
    connectCorners: boolean = active,
  ): void {
    this.renderChrome(
      buf,
      active ? CellAttr.Border : CellAttr.BorderDim,
      connectCorners,
    );
    this.renderContent(buf);
  }

  protected renderChrome(
    buf: Buffer2D,
    borderAttr: CellAttr,
    showCornerConnectors: boolean,
  ): void {
    const VERTICAL = "│";
    const TAB_CONTENT_WIDTH = 19;
    const tabWidth = Math.min(2 + TAB_CONTENT_WIDTH + 1, this.width);
    const roofWidth = Math.min(20, Math.max(0, this.width - 1));

    // Upper-left/upper-right corners connect down to the bottom border's right angles —
    // but a background card sitting behind an open submenu has its own bottom border
    // fully overwritten by the foreground card cascaded on top of it (same column), so
    // it never actually shows a lower-right angle. Don't connect the upper corners then;
    // fall back to the plain, disconnected tab style.
    const upperLeft = showCornerConnectors ? "┌" : " ";
    const upperRight = showCornerConnectors ? "┐" : " ";
    const topLineUnderscores = Math.max(0, this.width - tabWidth - 1);

    buf.writeText(
      this.x,
      this.y,
      upperLeft + "_".repeat(roofWidth),
      borderAttr,
    );

    const topLine =
      VERTICAL +
      " " +
      this.title.slice(0, TAB_CONTENT_WIDTH).padEnd(TAB_CONTENT_WIDTH) +
      "\\" +
      "_".repeat(topLineUnderscores) +
      upperRight;
    buf.writeText(this.x, this.y + 1, topLine, borderAttr);

    for (let row = 2; row < this.height - 1; row++) {
      buf.writeText(
        this.x,
        this.y + row,
        VERTICAL + " ".repeat(this.width - 2) + VERTICAL,
        borderAttr,
      );
    }

    const bottomLine = "└" + "─".repeat(this.width - 2) + "┘";
    buf.writeText(this.x, this.y + this.height - 1, bottomLine, borderAttr);
  }

  /** Interior content, drawn on top of the chrome. Coordinates are relative to (x, y). */
  protected abstract renderContent(buf: Buffer2D): void;

  protected writeRelative(
    buf: Buffer2D,
    dx: number,
    dy: number,
    text: string,
    attr: CellAttr = CellAttr.Normal,
  ): void {
    buf.writeText(this.x + dx, this.y + dy, text, attr);
  }

  /** Returns true if the key was consumed. */
  public abstract handleKey(key: string): boolean;
}
