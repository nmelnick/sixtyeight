export enum CellAttr {
  Normal = "normal",
  Dim = "dim",
  Reverse = "reverse",
  /** Bright white — card borders, tab titles. */
  Border = "border",
  /** Standard (dimmer) white — borders of a card sitting behind an open submenu. */
  BorderDim = "border-dim",
  /** Light green "phosphor" — top/bottom status bar text. */
  Header = "header",
  /** Standard white — regular menu item labels. */
  Menu = "menu",
  /** Yellow — the number/letter hotkey prefix on a menu item. */
  Hotkey = "hotkey",
  /** Light green — successful log entries. */
  Success = "success",
  /** Light red — failed log entries. */
  Error = "error",
}

// blessed's tag parser only recognizes a fixed set of style/color names (see
// Program.prototype.attr in blessed/lib/program.js) — there is no "dim" attribute,
// so a literal {dim} tag falls through unrecognized and prints as-is. Use a grey
// foreground color instead to get the same washed-out "disabled" look.
const TAG_OPEN: Record<Exclude<CellAttr, CellAttr.Normal>, string> = {
  [CellAttr.Dim]: "{grey-fg}",
  [CellAttr.Reverse]: "{inverse}",
  [CellAttr.Border]: "{bright-white-fg}",
  [CellAttr.BorderDim]: "{white-fg}",
  [CellAttr.Header]: "{light-green-fg}",
  [CellAttr.Menu]: "{white-fg}",
  [CellAttr.Hotkey]: "{bright-yellow-fg}{bold}",
  [CellAttr.Success]: "{light-green-fg}",
  [CellAttr.Error]: "{light-red-fg}",
};

const TAG_CLOSE: Record<Exclude<CellAttr, CellAttr.Normal>, string> = {
  [CellAttr.Dim]: "{/grey-fg}",
  [CellAttr.Reverse]: "{/inverse}",
  [CellAttr.Border]: "{/bright-white-fg}",
  [CellAttr.BorderDim]: "{/white-fg}",
  [CellAttr.Header]: "{/light-green-fg}",
  [CellAttr.Menu]: "{/white-fg}",
  [CellAttr.Hotkey]: "{/bold}{/bright-yellow-fg}",
  [CellAttr.Success]: "{/light-green-fg}",
  [CellAttr.Error]: "{/light-red-fg}",
};

function escapeTags(text: string): string {
  return text.replace(/[{}]/g, (m) => (m === "{" ? "{open}" : "{close}"));
}

export class Buffer2D {
  public readonly width: number;
  public readonly height: number;
  private chars: string[][];
  private attrs: CellAttr[][];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.chars = [];
    this.attrs = [];
    for (let y = 0; y < height; y++) {
      this.chars.push(new Array<string>(width).fill(" "));
      this.attrs.push(new Array<CellAttr>(width).fill(CellAttr.Normal));
    }
  }

  public writeText(
    x: number,
    y: number,
    text: string,
    attr: CellAttr = CellAttr.Normal,
  ): void {
    if (y < 0 || y >= this.height) {
      return;
    }
    for (let i = 0; i < text.length; i++) {
      const cx = x + i;
      if (cx < 0 || cx >= this.width) {
        continue;
      }
      this.chars[y][cx] = text[i]!;
      this.attrs[y][cx] = attr;
    }
  }

  public toBlessedContent(): string {
    const lines: string[] = [];
    for (let y = 0; y < this.height; y++) {
      const row = this.chars[y];
      const rowAttrs = this.attrs[y];
      let line = "";
      let runAttr: CellAttr = CellAttr.Normal;
      let run = "";
      const flush = () => {
        if (run.length === 0) {
          return;
        }
        if (runAttr === CellAttr.Normal) {
          line += escapeTags(run);
        } else {
          line += TAG_OPEN[runAttr] + escapeTags(run) + TAG_CLOSE[runAttr];
        }
        run = "";
      };
      for (let x = 0; x < this.width; x++) {
        const attr = rowAttrs[x];
        if (attr !== runAttr) {
          flush();
          runAttr = attr;
        }
        run += row[x];
      }
      flush();
      lines.push(line);
    }
    return lines.join("\n");
  }
}
