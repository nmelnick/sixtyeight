import { hexToNumber, numberToHex, splitNumberTwoBytes } from "./convert.js";
import { Logger } from "./logger.js";
import type { SerialConnection } from "./serial.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type TechStepCommand =
  | "V"
  | "S"
  | "A"
  | "H"
  | "R"
  | "T"
  | "N"
  | "L"
  | "B"
  | "D"
  | "M"
  | "C"
  | "G"
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "P"
  | "E"
  | "I"
  | "W"
  | "Q"
  | "U"
  | "Z";

const COMMANDS: Record<string, TechStepCommand> = {
  AsciiMode: "A",
  HexMode: "H",

  Version: "V",
  ReturnStatus: "R",

  CriticalTest: "T",
  NonCriticalTest: "N",

  LoadData: "L",
  ByteCount: "B",
  GetData: "D",
  CheckSum: "C",

  LoadA0: "0",
  LoadA1: "1",

  ClearResult: "4",

  StartBootMsg: "5",
  StopBanner: "S",
};

const MACHINE_TYPES: Record<string, string> = {
  "1": "II or SE/30",
  "2": "SE",
  "3": "Plus",
  "6": "Portable",
  "7": "IIci",
  "8": "IIfx",
  A: "IIci",
  B: "Classic",
  C: "IIsi",
  D: "LC",
  E: "Quadra 900",
  H: "PowerBook 170",
  I: "Quadra 700",
  J: "Classic II",
  L: "PowerBook 140",
  M: "Quadra 950",
  N: "LC III",
  O: "IIvx/IIvi",
  Q: "Centris 650",
  R: "Color Classic",
  T: "PowerBook 180",
  X: "LC II",
  e: "IIvi",
  f: "IIvx",
  j: "Color Classic",
  k: "PowerBook 165c",
  o: "PowerBook 145",
};

export enum TestFlag {
  STOP_ON_FIRST_FAILURE = 0x12,
  LOOP_ON_FAILURE_FOREVER = 0x13,
  STORE_TEST_RESULTS_IN_PRAM = 0x14,
  BOOT_AFTER_TEST_IS_DONE = 0x15,
}

export interface BannerResult {
  status: number;
  error: number;
  identifier: string;
  machineType?: string | undefined;
}

export class TechStep {
  private serial: SerialConnection;
  private userRequestedCancel: boolean = false;

  public inUse: boolean = false;
  public lastError: number = 0;
  public lastStatus: number = 0;

  constructor(serial: SerialConnection) {
    this.serial = serial;
  }

  public cancel() {
    if (this.inUse) {
      this.userRequestedCancel = true;
    }
  }

  public async ascii() {
    await this.startConversation();
    const result = await this.command(COMMANDS.AsciiMode);
    this.stopConversation();
    return result;
  }

  public async version() {
    await this.startConversation();
    const result = await this.command(COMMANDS.Version);
    this.stopConversation();
    return result;
  }

  public async banner() {
    await this.startConversation();
    await this.command(COMMANDS.StartBootMsg);
    const banner = await this.waitForBanner();
    await this.command(COMMANDS.StopBanner);
    this.stopConversation();
    await this.ascii();
    return this.parseBanner(banner);
  }

  public async getReturnStatus(): Promise<[number, number]> {
    await this.startConversation();
    const result = await this.command(COMMANDS.ReturnStatus);
    this.stopConversation();
    return this.parseResult(result || "");
  }

  public async clearResult(): Promise<void> {
    await this.startConversation();
    await this.command(COMMANDS.ClearResult);
    this.stopConversation();
  }

  public criticalTest = {
    sizeMemory: async (
      numberOfAttempts: number = 1,
      testFlags?: TestFlag[],
    ) => {
      await this.startConversation();
      await this.runCriticalTest(0, numberOfAttempts, testFlags);
      this.stopConversation();
    },
    dataBusTest: async (
      startAddress: number,
      numberOfAttempts: number = 1,
      testFlags?: TestFlag[],
    ) => {
      await this.startConversation();
      await this.command(COMMANDS.LoadA0, ...splitNumberTwoBytes(startAddress));
      await this.runCriticalTest(1, numberOfAttempts, testFlags);
      this.stopConversation();
    },
    mod3RamTest: async (
      startAddress: number,
      endAddress: number,
      numberOfAttempts: number = 1,
      testFlags?: TestFlag[],
    ) => {
      await this.startConversation();
      await this.command(COMMANDS.LoadA0, ...splitNumberTwoBytes(startAddress));
      await this.command(COMMANDS.LoadA1, ...splitNumberTwoBytes(endAddress));
      await this.runCriticalTest(2, numberOfAttempts, testFlags);
      this.stopConversation();
    },
    addressLineTest: async (
      memorySize: number,
      numberOfAttempts: number = 1,
      testFlags?: TestFlag[],
    ) => {
      await this.startConversation();
      await this.command(COMMANDS.LoadA0, ...splitNumberTwoBytes(memorySize));
      await this.runCriticalTest(3, numberOfAttempts, testFlags);
      this.stopConversation();
    },
    romChecksum: async (
      numberOfAttempts: number = 1,
      testFlags?: TestFlag[],
    ) => {
      await this.startConversation();
      await this.runCriticalTest(4, numberOfAttempts, testFlags);
      this.stopConversation();
    },
    revMod3Test: async (
      startAddress: number,
      endAddress: number,
      numberOfAttempts: number = 1,
      testFlags?: TestFlag[],
    ) => {
      await this.startConversation();
      await this.command(COMMANDS.LoadA0, ...splitNumberTwoBytes(startAddress));
      await this.command(COMMANDS.LoadA1, ...splitNumberTwoBytes(endAddress));
      await this.runCriticalTest(5, numberOfAttempts, testFlags);
      this.stopConversation();
    },
    extraRamTest: async (
      startAddress: number,
      endAddress: number,
      numberOfAttempts: number = 1,
      testFlags?: TestFlag[],
    ) => {
      await this.startConversation();
      await this.command(COMMANDS.LoadA0, ...splitNumberTwoBytes(startAddress));
      await this.command(COMMANDS.LoadA1, ...splitNumberTwoBytes(endAddress));
      await this.runCriticalTest(6, numberOfAttempts, testFlags);
      this.stopConversation();
    },
    modInvramTest: async (
      startAddress: number,
      endAddress: number,
      numberOfAttempts: number = 1,
      testFlags?: TestFlag[],
    ) => {
      await this.startConversation();
      await this.command(COMMANDS.LoadA0, ...splitNumberTwoBytes(startAddress));
      await this.command(COMMANDS.LoadA1, ...splitNumberTwoBytes(endAddress));
      await this.runCriticalTest(7, numberOfAttempts, testFlags);
      this.stopConversation();
    },
    sizeVideoRamTest: async (
      numberOfAttempts: number = 1,
      testFlags?: TestFlag[],
    ) => {
      await this.startConversation();
      await this.runCriticalTest(8, numberOfAttempts, testFlags);
      this.stopConversation();
    },
  };

  private async runCriticalTest(
    testNumber: number,
    numberOfAttempts: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- flag handling is pending research, see TODO below
    testFlags?: TestFlag[],
  ) {
    const flags = 1;
    // TODO: Flag operations require research.
    // if (testFlags) {
    //   for (const flag of testFlags) {
    //     flags = flags | 1 << flag;
    //   }
    // } else {
    //   flags = 1;
    // }
    return await this.command(
      COMMANDS.CriticalTest,
      testNumber,
      numberOfAttempts,
      flags,
    );
  }

  private parseBanner(banner: string): BannerResult {
    if (!banner.startsWith("*APPLE*")) {
      Logger.error(`Invalid banner: ${banner}`);
      throw new Error("Invalid banner");
    }
    const [, , result, identifier] = banner.split("*");
    const [status, error] = this.parseResult(result);
    return {
      status: status,
      error: error,
      identifier: identifier,
      machineType: MACHINE_TYPES[identifier],
    };
  }

  private parseResult(result: string): [number, number] {
    const status = hexToNumber(result.substring(0, 8));
    const error = hexToNumber(result.substring(8));
    this.lastStatus = status;
    this.lastError = error;
    return [status, error];
  }

  private async waitForBanner(): Promise<string> {
    const line = await this.serial.waitForResponse();
    if (line.indexOf("APPLE") > -1) {
      return line;
    }
    throw new Error();
  }

  private async command(
    letter: TechStepCommand,
    word1?: number,
    word2?: number,
    word3?: number,
  ): Promise<string | void> {
    const prefix = ["*", letter].join("");
    let words = "";
    for (const word of [word1, word2, word3]) {
      if (word != null) {
        words = words + numberToHex(word);
      }
    }
    const ascii = [prefix, words].join("");
    return await this.executeSerial(ascii, prefix);
  }

  private async executeSerial(
    command: string,
    waitFor?: string,
  ): Promise<string | void> {
    await this.serial.send(command);
    const result = await this.serial.waitForResponse();
    if (waitFor && result === waitFor) {
      return;
    } else if (waitFor && result.indexOf("ERROR") > -1) {
      this.stopConversation();
      throw new Error(result);
    }
    return result;
  }

  private async startConversation() {
    while (this.inUse) {
      await sleep(10);
    }
    this.inUse = true;
  }

  private stopConversation() {
    this.inUse = false;
    this.userRequestedCancel = false;
  }

  private checkCancel(): void {
    if (this.inUse && this.userRequestedCancel) {
      this.stopConversation();
      throw new Error("User cancel");
    }
  }
}
