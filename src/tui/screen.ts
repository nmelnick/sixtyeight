import blessed from "blessed";
import { CardStack } from "./card-stack.js";
import { Logger } from "../logger.js";

const KEY_NAME_MAP: Record<string, string> = {
  up: "up",
  down: "down",
  left: "left",
  right: "right",
  return: "return",
  enter: "return",
  escape: "escape",
  backspace: "backspace",
  pageup: "pageup",
  pagedown: "pagedown",
};

export class Screen {
  private screen: blessed.Widgets.Screen;
  private canvas: blessed.Widgets.BoxElement;
  private cardStack: CardStack;

  constructor(cardStack: CardStack) {
    this.cardStack = cardStack;
    this.screen = blessed.screen({
      smartCSR: true,
      title: "sixtyeight",
      fullUnicode: true,
    });
    this.canvas = blessed.box({
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      tags: true,
      wrap: false,
      style: {},
    });
    this.screen.append(this.canvas);

    this.screen.on("resize", () => this.render());
    this.screen.key(["C-c"], () => process.exit(0));
    this.screen.on(
      "keypress",
      (ch: string, key: blessed.Widgets.Events.IKeyEventArg) => {
        this.onKey(ch, key);
      },
    );
    Logger.onAppend(() => this.render());
  }

  private onKey(ch: string, key: blessed.Widgets.Events.IKeyEventArg): void {
    const name = key.name ? (KEY_NAME_MAP[key.name] ?? key.name) : ch;
    if (!name) {
      return;
    }
    this.cardStack.handleKey(name);
    this.render();
  }

  public start(): void {
    this.render();
  }

  public render(): void {
    const width = this.screen.width as number;
    const height = this.screen.height as number;
    this.cardStack.layout(width, height);
    const buf = this.cardStack.render();
    this.canvas.setContent(buf.toBlessedContent());
    this.screen.render();
  }
}
