import fs from 'node:fs';
import path from 'node:path';

const CONFIG_PATH = path.resolve(process.cwd(), 'sixtyeight.config.json');

interface ConfigFile {
  serialPort: string;
}

export class Config {
  public static serialPort: string = '/dev/ttyUSB0';

  public static exists(): boolean {
    return fs.existsSync(CONFIG_PATH);
  }

  public static load(): void {
    let parsed: Partial<ConfigFile> | undefined;
    try {
      parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    } catch {
      return;
    }
    if (parsed?.serialPort) {
      Config.serialPort = parsed.serialPort;
    }
  }

  public static save(): void {
    const data: ConfigFile = { serialPort: Config.serialPort };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  }
}
