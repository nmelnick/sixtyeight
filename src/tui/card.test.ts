import { describe, expect, it } from "vitest";
import { Buffer2D } from "./buffer.js";
import { Card } from "./card.js";

class TestCard extends Card {
  protected renderContent(): void {
    // no interior content — chrome only, for comparing against the reference screenshots
  }

  public handleKey(): boolean {
    return false;
  }
}

describe("Card chrome", () => {
  it("matches the FileCard border art from 68-filecard.txt, in bright white with real box-drawing verticals", () => {
    const buf = new Buffer2D(80, 4);
    const card = new TestCard("Main Menu", 1, 0, 77, 4);
    card.render(buf);

    const lines = buf
      .toBlessedContent()
      .split("\n")
      .map((line) => line.replace(/ +$/, ""));
    const open = "{bright-white-fg}";
    const close = "{/bright-white-fg}";
    expect(lines[0]).toBe(` ${open}┌____________________${close}`);
    expect(lines[1]).toBe(
      ` ${open}│ Main Menu          \\______________________________________________________┐${close}`,
    );
    expect(lines[2]).toBe(` ${open}│${" ".repeat(75)}│${close}`);
    expect(lines[3]).toBe(` ${open}└${"─".repeat(75)}┘${close}`);
  });

  it("renders a dimmer, disconnected tab when inactive (its own lower-right angle would be hidden behind the card cascaded on top of it)", () => {
    const buf = new Buffer2D(80, 4);
    const card = new TestCard("Main Menu", 1, 0, 77, 4);
    card.render(buf, false);

    const lines = buf
      .toBlessedContent()
      .split("\n")
      .map((line) => line.replace(/ +$/, ""));
    const open = "{white-fg}";
    const close = "{/white-fg}";
    expect(lines[0]).toBe(` ${open} ____________________${close}`);
    expect(lines[1]).toBe(
      ` ${open}│ Main Menu          \\______________________________________________________${close}`,
    );
  });

  it("stays disconnected even when active, if the card is the root/base and not cascaded on top of anything", () => {
    const buf = new Buffer2D(80, 4);
    const card = new TestCard("Main Menu", 1, 0, 77, 4);
    card.render(buf, true, false);

    const lines = buf
      .toBlessedContent()
      .split("\n")
      .map((line) => line.replace(/ +$/, ""));
    const open = "{bright-white-fg}";
    const close = "{/bright-white-fg}";
    expect(lines[0]).toBe(` ${open} ____________________${close}`);
    expect(lines[1]).toBe(
      ` ${open}│ Main Menu          \\______________________________________________________${close}`,
    );
  });
});
