import fs from "node:fs";
import path from "node:path";

const CONFIG_PATH = path.resolve(process.cwd(), "sixtyeight.config.json");

interface ConfigFile {
  serialPort: string;
  ignoreCapabilityDimming: boolean;
  writeActivityLogToFile: boolean;
}

export class Config {
  public static serialPort: string = "/dev/ttyUSB0";
  public static ignoreCapabilityDimming: boolean = false;
  public static writeActivityLogToFile: boolean = false;

  public static exists(): boolean {
    return fs.existsSync(CONFIG_PATH);
  }

  public static load(): void {
    let parsed: Partial<ConfigFile> | undefined;
    try {
      parsed = JSON.parse(
        fs.readFileSync(CONFIG_PATH, "utf-8"),
      ) as Partial<ConfigFile>;
    } catch {
      return;
    }
    if (parsed?.serialPort) {
      Config.serialPort = parsed.serialPort;
    }
    if (parsed?.ignoreCapabilityDimming !== undefined) {
      Config.ignoreCapabilityDimming = parsed.ignoreCapabilityDimming;
    }
    if (parsed?.writeActivityLogToFile !== undefined) {
      Config.writeActivityLogToFile = parsed.writeActivityLogToFile;
    }
  }

  public static save(): void {
    const data: ConfigFile = {
      serialPort: Config.serialPort,
      ignoreCapabilityDimming: Config.ignoreCapabilityDimming,
      writeActivityLogToFile: Config.writeActivityLogToFile,
    };
    fs.writeFileSync(
      CONFIG_PATH,
      JSON.stringify(data, null, 2) + "\n",
      "utf-8",
    );
  }
}
