import { Buffer2D } from "./buffer.js";
import { Card } from "./card.js";

export class LogCard extends Card {
  private scrollOffset: number = 0;

  constructor(
    title: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    super(title, x, y, width, height);
  }

  protected getBufferSource(): readonly string[] {
    return [];
  }

  public resize(x: number, y: number, width: number, height: number): void {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  public scroll(delta: number): void {
    const lines = this.getBufferSource();
    const visibleRows = this.height - 3;
    const maxOffset = Math.max(0, lines.length - visibleRows);
    this.scrollOffset = Math.min(
      maxOffset,
      Math.max(0, this.scrollOffset + delta),
    );
  }

  public resetScroll(): void {
    this.scrollOffset = 0;
  }

  protected renderContent(buf: Buffer2D): void {
    const lines = this.getBufferSource();
    const visibleRows = this.height - 3;
    const end = lines.length - this.scrollOffset;
    const start = Math.max(0, end - visibleRows);
    const visible = lines.slice(start, end);
    const innerWidth = this.width - 4;

    visible.forEach((line, i) => {
      const clipped =
        line.length > innerWidth ? line.slice(0, innerWidth) : line;
      this.writeRelative(buf, 2, 2 + i, clipped);
    });
  }

  public handleKey(key: string): boolean {
    switch (key) {
      case "up":
        this.scroll(1);
        return true;
      case "down":
        this.scroll(-1);
        return true;
      case "pageup":
        this.scroll(Math.max(1, this.height - 4));
        return true;
      case "pagedown":
        this.scroll(-Math.max(1, this.height - 4));
        return true;
      default:
        return false;
    }
  }
}
