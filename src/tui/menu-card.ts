import { Buffer2D, CellAttr } from "./buffer.js";
import { Card } from "./card.js";

export interface MenuItemField {
  getValue: () => string;
  onSubmit: (value: string) => void;
  maxLength?: number;
}

export interface MenuItem {
  key: string;
  label: string;
  enabled?: boolean | (() => boolean);
  column?: 0 | 1;
  onSelect?: () => void | Promise<void>;
  submenu?: () => Card;
  field?: MenuItemField;
}

const FIRST_ITEM_Y = 3;
const ITEM_SPACING = 2;

export class MenuCard extends Card {
  private items: MenuItem[];
  /**
   * No item is selected when a card is first shown — Enter is a no-op until the
   * user explicitly arrows to an item or presses its hotkey. This prevents a
   * stray/repeated Enter (e.g. held down while dismissing the parent menu) from
   * landing on a pre-armed first item and firing a test the moment a submenu opens.
   */
  private selectedIndex: number | null;
  private secondColumnX: number;
  private onPush: ((card: Card) => void) | undefined;
  private onPop: (() => void) | undefined;
  private isBusy: (() => boolean) | undefined;
  private editingValue: string | undefined;

  constructor(
    title: string,
    x: number,
    y: number,
    width: number,
    height: number,
    items: MenuItem[],
    options?: {
      onPush?: (card: Card) => void;
      onPop?: () => void;
      isBusy?: () => boolean;
      secondColumnX?: number;
    },
  ) {
    super(title, x, y, width, height);
    this.items = items;
    this.onPush = options?.onPush;
    this.onPop = options?.onPop;
    this.isBusy = options?.isBusy;
    this.secondColumnX = options?.secondColumnX ?? Math.round(width / 2) + 3;
    this.selectedIndex = null;
  }

  private isEnabled(item: MenuItem): boolean {
    if (typeof item.enabled === "function") {
      return item.enabled();
    }
    return item.enabled !== false;
  }

  private columnOf(item: MenuItem): 0 | 1 {
    return item.column ?? 0;
  }

  private rowOf(item: MenuItem): number {
    const columnItems = this.items.filter(
      (i) => this.columnOf(i) === this.columnOf(item),
    );
    return columnItems.indexOf(item);
  }

  protected renderContent(buf: Buffer2D): void {
    this.items.forEach((item, index) => {
      const column = this.columnOf(item);
      const row = this.rowOf(item);
      const dx = column === 0 ? 3 : this.secondColumnX;
      const dy = FIRST_ITEM_Y + row * ITEM_SPACING;
      const enabled = this.isEnabled(item);
      const selected = index === this.selectedIndex;

      if (this.editingValue !== undefined && selected && item.field) {
        this.writeRelative(
          buf,
          dx,
          dy,
          `${item.key}. ${item.label}: ${this.editingValue}_`,
          CellAttr.Reverse,
        );
        return;
      }

      const hotkey = `${item.key}.`;
      let rest = ` ${item.label}`;
      if (item.field) {
        rest += `: ${item.field.getValue()}`;
      }

      if (!enabled) {
        this.writeRelative(buf, dx, dy, hotkey + rest, CellAttr.Dim);
      } else if (selected) {
        this.writeRelative(buf, dx, dy, hotkey + rest, CellAttr.Reverse);
      } else {
        this.writeRelative(buf, dx, dy, hotkey, CellAttr.Hotkey);
        this.writeRelative(buf, dx + hotkey.length, dy, rest, CellAttr.Menu);
      }
    });
  }

  public handleKey(key: string): boolean {
    if (this.editingValue !== undefined) {
      return this.handleEditKey(key);
    }

    switch (key) {
      case "up":
        this.moveSelection(0, -1);
        return true;
      case "down":
        this.moveSelection(0, 1);
        return true;
      case "left":
        this.moveSelection(-1, 0);
        return true;
      case "right":
        this.moveSelection(1, 0);
        return true;
      case "return":
        this.activate(
          this.selectedIndex !== null
            ? this.items[this.selectedIndex]
            : undefined,
        );
        return true;
      case "escape":
        this.onPop?.();
        return true;
      default:
        return this.handleDirectKey(key);
    }
  }

  private handleDirectKey(key: string): boolean {
    const index = this.items.findIndex(
      (item) => item.key.toLowerCase() === key.toLowerCase(),
    );
    if (index < 0) {
      return false;
    }
    const item = this.items[index];
    if (!this.isEnabled(item)) {
      return false;
    }
    this.selectedIndex = index;
    this.activate(item);
    return true;
  }

  private moveSelection(dCol: number, dRow: number): void {
    if (this.selectedIndex === null) {
      // First arrow press just reveals a starting position; it doesn't activate anything.
      const first = this.items.findIndex((item) => this.isEnabled(item));
      if (first >= 0) {
        this.selectedIndex = first;
      }
      return;
    }

    const current = this.items[this.selectedIndex];
    if (!current) {
      return;
    }
    const currentColumn = this.columnOf(current);
    const currentRow = this.rowOf(current);
    const targetColumn = ((currentColumn + dCol + 2) % 2) as 0 | 1;

    const candidates = this.items
      .map((item, index) => ({ item, index, row: this.rowOf(item) }))
      .filter(({ item }) => this.columnOf(item) === targetColumn)
      .filter(({ item }) => this.isEnabled(item));

    if (candidates.length === 0) {
      return;
    }

    if (dCol !== 0) {
      let best = candidates[0];
      for (const c of candidates) {
        if (Math.abs(c.row - currentRow) < Math.abs(best.row - currentRow)) {
          best = c;
        }
      }
      this.selectedIndex = best.index;
      return;
    }

    const sorted = candidates.sort((a, b) => a.row - b.row);
    const forward = dRow > 0;
    const next = forward
      ? sorted.find((c) => c.row > currentRow)
      : [...sorted].reverse().find((c) => c.row < currentRow);
    if (next) {
      this.selectedIndex = next.index;
    }
  }

  private activate(item: MenuItem | undefined): void {
    if (!item || !this.isEnabled(item)) {
      return;
    }
    if (item.field) {
      this.editingValue = item.field.getValue();
      return;
    }
    if (item.submenu) {
      this.onPush?.(item.submenu());
      return;
    }
    if (item.onSelect && this.isBusy?.()) {
      return;
    }
    void item.onSelect?.();
  }

  private handleEditKey(key: string): boolean {
    if (key === "return") {
      const item =
        this.selectedIndex !== null
          ? this.items[this.selectedIndex]
          : undefined;
      if (item?.field && this.editingValue !== undefined) {
        item.field.onSubmit(this.editingValue);
      }
      this.editingValue = undefined;
      return true;
    }
    if (key === "escape") {
      this.editingValue = undefined;
      return true;
    }
    if (key === "backspace") {
      this.editingValue = (this.editingValue ?? "").slice(0, -1);
      return true;
    }
    if (key.length === 1) {
      const item =
        this.selectedIndex !== null
          ? this.items[this.selectedIndex]
          : undefined;
      const maxLength = item?.field?.maxLength;
      const current = this.editingValue ?? "";
      if (maxLength === undefined || current.length < maxLength) {
        this.editingValue = current + key;
      }
      return true;
    }
    return true;
  }

  public isEditing(): boolean {
    return this.editingValue !== undefined;
  }
}
