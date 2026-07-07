const MAX_LINES = 500;

function timestamp(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

class LoggerImpl {
  private lines: string[] = [];
  private listeners: ((line: string) => void)[] = [];

  public log(message: string): void {
    this.append(message);
  }

  public error(message: string): void {
    this.append(`Error: ${message}`);
  }

  public getLines(): readonly string[] {
    return this.lines;
  }

  public onAppend(cb: (line: string) => void): void {
    this.listeners.push(cb);
  }

  private append(message: string): void {
    const line = `[${timestamp()}] ${message}`;
    this.lines.push(line);
    if (this.lines.length > MAX_LINES) {
      this.lines.shift();
    }
    for (const cb of this.listeners) {
      cb(line);
    }
  }
}

export const Logger = new LoggerImpl();
