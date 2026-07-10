import { numberToHex } from "../convert.js";
import { VERSION } from "../version.js";

function padBetween(left: string, right: string, width: number): string {
  const gap = Math.max(1, width - left.length - right.length);
  return left + " ".repeat(gap) + right;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function topBar(
  width: number,
  connected: boolean,
  port: string,
  machineIdentity?: string,
): string {
  const left =
    ` sixtyeight ${VERSION}` +
    (machineIdentity ? ` - Macintosh ${machineIdentity}` : "");
  const right = `[S] ${connected ? "Connected" : "Disconnected"} - ${port}`;
  return padBetween(left, right, width);
}

export function separatorLine(width: number): string {
  return "-".repeat(width);
}

export function bottomBar(
  width: number,
  lastStatus: number,
  lastError: number,
  sessionElapsedMs: number,
  lastMessageElapsedMs: number,
): string {
  const left = ` Last Status: ${numberToHex(lastStatus, 8)} (${lastStatus}) | Last Error: ${numberToHex(lastError)} (${lastError})`;
  const right = `ST ${formatElapsed(sessionElapsedMs)} / LM ${formatElapsed(lastMessageElapsedMs)}`;
  return padBetween(left, right, width);
}
