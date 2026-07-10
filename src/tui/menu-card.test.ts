import { describe, expect, it, vi } from "vitest";
import { MenuCard, type MenuItem } from "./menu-card.js";
import type { Card } from "./card.js";

function singleColumnItems(): MenuItem[] {
  return [
    { key: "1", label: "Get Status" },
    { key: "2", label: "Identify Machine" },
    { key: "3", label: "Critical Tests" },
    { key: "4", label: "Non-Critical Tests", enabled: false },
  ];
}

describe("MenuCard navigation", () => {
  it("does not activate anything if Enter arrives before any navigation (no pre-armed item on open)", () => {
    const items = singleColumnItems();
    const selects = items.map(() => vi.fn());
    items.forEach((item, i) => (item.onSelect = selects[i]));
    const menu = new MenuCard("Critical Tests", 0, 0, 40, 10, items);

    menu.handleKey("return");

    expect(selects.some((fn) => fn.mock.calls.length > 0)).toBe(false);
  });

  it("the first arrow press only reveals a starting position, it does not activate it", () => {
    const items: MenuItem[] = [
      { key: "1", label: "Disabled first", enabled: false },
      { key: "2", label: "Enabled second" },
    ];
    const onSelect = vi.fn();
    items[1].onSelect = onSelect;
    const menu = new MenuCard("Test", 0, 0, 40, 10, items);

    menu.handleKey("down"); // reveals item 2 (skipping the disabled first item), doesn't run it
    expect(onSelect).not.toHaveBeenCalled();

    menu.handleKey("return"); // now it activates
    expect(onSelect).toHaveBeenCalled();
  });

  it("skips disabled items when moving down/up", () => {
    const items = singleColumnItems();
    const selects = items.map(() => vi.fn());
    items.forEach((item, i) => (item.onSelect = selects[i]));
    const menu = new MenuCard("Main Menu", 0, 0, 40, 10, items);

    menu.handleKey("down"); // wake -> item 1
    menu.handleKey("down"); // -> item 2
    menu.handleKey("down"); // -> item 3
    menu.handleKey("down"); // item 4 is disabled, should stay on item 3
    menu.handleKey("return");
    expect(selects[2]).toHaveBeenCalled();
  });

  it("ignores direct key-press for a disabled item", () => {
    const items = singleColumnItems();
    const onSelect = vi.fn();
    items[3].onSelect = onSelect;
    const menu = new MenuCard("Main Menu", 0, 0, 40, 10, items);

    menu.handleKey("4");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("activates an item directly via its key", () => {
    const items = singleColumnItems();
    const onSelect = vi.fn();
    items[2].onSelect = onSelect;
    const menu = new MenuCard("Main Menu", 0, 0, 40, 10, items);

    menu.handleKey("3");
    expect(onSelect).toHaveBeenCalled();
  });

  it("navigates across columns with left/right, matching same row", () => {
    const items: MenuItem[] = [
      { key: "1", label: "A", column: 0 },
      { key: "2", label: "B", column: 0 },
      { key: "7", label: "G", column: 1 },
      { key: "8", label: "H", column: 1 },
    ];
    const selects = items.map(() => vi.fn());
    items.forEach((item, i) => (item.onSelect = selects[i]));
    const menu = new MenuCard("Critical Tests", 0, 0, 76, 14, items);

    menu.handleKey("down"); // wake -> column 0, row 0 -> item '1'
    menu.handleKey("down"); // column 0, row 1 -> item '2'
    menu.handleKey("right"); // same row (1) in column 1 -> item '8'
    menu.handleKey("return");
    expect(selects[3]).toHaveBeenCalled();
  });

  it("pushes a submenu card when an item with submenu is activated via its hotkey", () => {
    const onPush = vi.fn();
    const child = { title: "child" };
    const items: MenuItem[] = [
      {
        key: "1",
        label: "Critical Tests",
        submenu: () => child as unknown as Card,
      },
    ];
    const menu = new MenuCard("Main Menu", 0, 0, 40, 10, items, { onPush });

    menu.handleKey("1");
    expect(onPush).toHaveBeenCalledWith(child);
  });

  it("pops via onPop when Escape is pressed", () => {
    const onPop = vi.fn();
    const menu = new MenuCard(
      "Critical Tests",
      0,
      0,
      40,
      10,
      singleColumnItems(),
      { onPop },
    );

    menu.handleKey("escape");
    expect(onPop).toHaveBeenCalled();
  });

  it("enters edit mode for a text field item and commits on Enter", () => {
    const onSubmit = vi.fn();
    const items: MenuItem[] = [
      {
        key: "P",
        label: "Serial port",
        field: { getValue: () => "/dev/pts/3", onSubmit },
      },
    ];
    const menu = new MenuCard("Settings", 0, 0, 40, 10, items);

    menu.handleKey("P");
    expect(menu.isEditing()).toBe(true);

    menu.handleKey("backspace");
    menu.handleKey("1");
    menu.handleKey("return");

    expect(onSubmit).toHaveBeenCalledWith("/dev/pts/1");
    expect(menu.isEditing()).toBe(false);
  });

  it("cancels editing on Escape without submitting", () => {
    const onSubmit = vi.fn();
    const items: MenuItem[] = [
      {
        key: "P",
        label: "Serial port",
        field: { getValue: () => "/dev/pts/3", onSubmit },
      },
    ];
    const menu = new MenuCard("Settings", 0, 0, 40, 10, items);

    menu.handleKey("P");
    menu.handleKey("escape");

    expect(onSubmit).not.toHaveBeenCalled();
    expect(menu.isEditing()).toBe(false);
  });

  it("refuses to type past a field's maxLength", () => {
    const onSubmit = vi.fn();
    const items: MenuItem[] = [
      {
        key: "S",
        label: "Start Address",
        field: { getValue: () => "", onSubmit, maxLength: 3 },
      },
    ];
    const menu = new MenuCard("Memory Monitor", 0, 0, 40, 10, items);

    menu.handleKey("S");
    for (const key of ["1", "2", "3", "4", "5"]) {
      menu.handleKey(key);
    }
    menu.handleKey("return");

    expect(onSubmit).toHaveBeenCalledWith("123");
  });
});
