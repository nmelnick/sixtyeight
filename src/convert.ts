export function numberToHex(num: number, padding: number = 4): string {
  return num.toString(16).padStart(padding, "0").toUpperCase();
}

export function hexToNumber(hex: string): number {
  return parseInt(hex, 16);
}

export function splitNumberTwoBytes(num: number): number[] {
  return (numberToHex(num, 8).match(/.{4}/g) || ["", ""]).map((v) =>
    hexToNumber(v),
  );
}
