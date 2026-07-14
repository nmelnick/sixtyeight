import { hexToNumber, numberToHex, toAsciiChar } from "../convert.js";
import { Logger } from "../logger.js";
import type { TechStep } from "../techstep.js";
import { Buffer2D, CellAttr } from "./buffer.js";
import { Card } from "./card.js";
import { handleTextFieldKey } from "./text-field.js";

const BYTES_PER_ROW_WIDE = 16;
const BYTES_PER_ROW_NARROW = 8;
const READ_CHUNK_SIZE = 64;
const CHUNK_RETRY_ATTEMPTS = 3;
const JUMP_ROW = 3;
const DATA_START_ROW = 5;
const ADDRESS_MAX_LENGTH = 8;

function rowWidth(bytesPerRow: number): number {
  const offsetWidth = 8;
  const hexWidth = bytesPerRow * 3 - 1;
  const asciiWidth = bytesPerRow;
  return offsetWidth + 2 + hexWidth + 2 + asciiWidth;
}

export class HexViewCard extends Card {
  private techstep: Pick<TechStep, "readMemory">;
  private onPop: () => void;
  private startAddress: number;
  private bytes: Map<number, number> = new Map();
  private loading: boolean = false;
  private pendingReload: boolean = false;
  private editingValue: string | undefined;

  constructor(
    techstep: Pick<TechStep, "readMemory">,
    startAddress: number,
    onPop: () => void,
    x: number = 0,
    y: number = 0,
    width: number = 0,
    height: number = 0,
  ) {
    super("View Memory", x, y, width, height);
    this.techstep = techstep;
    this.onPop = onPop;
    this.startAddress = startAddress;
    this.editingValue = numberToHex(startAddress, 8);
  }

  private bytesPerRow(): number {
    const innerWidth = this.width - 4;
    return innerWidth >= rowWidth(BYTES_PER_ROW_WIDE)
      ? BYTES_PER_ROW_WIDE
      : BYTES_PER_ROW_NARROW;
  }

  private visibleRows(): number {
    const raw = Math.max(1, this.height - 3 - (DATA_START_ROW - 2));
    const rowsPerChunk = Math.max(
      1,
      Math.floor(READ_CHUNK_SIZE / this.bytesPerRow()),
    );
    const rounded = Math.floor(raw / rowsPerChunk) * rowsPerChunk;
    return rounded > 0 ? rounded : raw;
  }

  private async loadPage(): Promise<void> {
    if (this.loading) {
      this.pendingReload = true;
      return;
    }
    this.loading = true;
    do {
      this.pendingReload = false;
      const total = this.bytesPerRow() * this.visibleRows();
      this.bytes.clear();
      for (let offset = 0; offset < total; offset += READ_CHUNK_SIZE) {
        const address = this.startAddress + offset;
        let values: number[] | undefined;
        let lastError: unknown;
        for (let attempt = 0; attempt < CHUNK_RETRY_ATTEMPTS; attempt++) {
          try {
            values = await this.techstep.readMemory(address, READ_CHUNK_SIZE);
            break;
          } catch (e: unknown) {
            lastError = e;
          }
        }
        if (values) {
          values.forEach((value, i) => this.bytes.set(address + i, value));
        } else {
          Logger.error(
            `View Memory read of ${numberToHex(address, 8)} failed: ${Error.isError(lastError) ? lastError.message : ""}`,
          );
        }
      }
    } while (this.pendingReload);
    this.loading = false;
    Logger.log("View Memory page loaded");
  }

  private nextPage(): void {
    this.startAddress += this.bytesPerRow() * this.visibleRows();
    void this.loadPage();
  }

  private previousPage(): void {
    this.startAddress = Math.max(
      0,
      this.startAddress - this.bytesPerRow() * this.visibleRows(),
    );
    void this.loadPage();
  }

  private jumpTo(address: number): void {
    this.startAddress = Math.max(0, address);
    void this.loadPage();
  }

  private writeHotkeyLabel(
    buf: Buffer2D,
    x: number,
    y: number,
    key: string,
    rest: string,
  ): number {
    this.writeRelative(buf, x, y, "[", CellAttr.Menu);
    this.writeRelative(buf, x + 1, y, key, CellAttr.Hotkey);
    this.writeRelative(buf, x + 2, y, `]${rest}`, CellAttr.Menu);
    return `[${key}]${rest}`.length;
  }

  protected renderContent(buf: Buffer2D): void {
    let x = 2;
    x += this.writeHotkeyLabel(buf, x, JUMP_ROW, "R", "efresh") + 2;

    if (this.editingValue !== undefined) {
      const text = `[A] Jump to address: ${this.editingValue}_`;
      this.writeRelative(buf, x, JUMP_ROW, text, CellAttr.Reverse);
    } else {
      this.writeHotkeyLabel(
        buf,
        x,
        JUMP_ROW,
        "A",
        ` Jump to address: ${numberToHex(this.startAddress, 8)}`,
      );
    }

    const bytesPerRow = this.bytesPerRow();
    const rows = this.visibleRows();
    for (let row = 0; row < rows; row++) {
      const address = this.startAddress + row * bytesPerRow;
      const hexParts: string[] = [];
      let ascii = "";
      for (let i = 0; i < bytesPerRow; i++) {
        const value = this.bytes.get(address + i);
        hexParts.push(value === undefined ? "--" : numberToHex(value, 2));
        ascii += value === undefined ? "." : toAsciiChar(value);
      }
      const line = `${numberToHex(address, 8)}  ${hexParts.join(" ")}  ${ascii}`;
      this.writeRelative(buf, 2, DATA_START_ROW + row, line, CellAttr.Menu);
    }
  }

  public handleKey(key: string): boolean {
    if (this.editingValue !== undefined) {
      return this.handleEditKey(key);
    }

    switch (key) {
      case "pagedown":
        this.nextPage();
        return true;
      case "pageup":
        this.previousPage();
        return true;
      case "escape":
        this.onPop();
        return true;
      case "a":
      case "A":
        this.editingValue = numberToHex(this.startAddress, 8);
        return true;
      case "r":
      case "R":
        void this.loadPage();
        return true;
      default:
        return false;
    }
  }

  private handleEditKey(key: string): boolean {
    const result = handleTextFieldKey(
      this.editingValue ?? "",
      key,
      ADDRESS_MAX_LENGTH,
    );
    if (result.action === "commit") {
      const parsed = hexToNumber(this.editingValue ?? "");
      if (!Number.isNaN(parsed)) {
        this.jumpTo(parsed);
      }
      this.editingValue = undefined;
    } else if (result.action === "cancel") {
      this.editingValue = undefined;
      if (this.bytes.size === 0) {
        void this.loadPage();
      }
    } else {
      this.editingValue = result.value;
    }
    return true;
  }
}
