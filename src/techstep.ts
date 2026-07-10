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
  MemDump: "M",

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

export const NonCriticalTests: Record<string, number> = {
  "Mapper RAM data test (Portable)": 0x80,
  "Mapper RAM unique test (Portable)": 0x81,
  "VRAM data test (Portable)": 0x82,
  "VRAM address test (Portable)": 0x83,
  "SCC test 1": 0x84,
  "SCC test 2": 0x85,
  "SCC test 3": 0x86,
  "VIA test": 0x87,
  "General SCSI test": 0x88,
  Sound: 0x89,
  PRAM: 0x8a,
  RBV: 0x8b,
  SWIM: 0x8c,
  FPU: 0x8d,
  "PGC - Parity Generator/Checker": 0x8e,
  "FMC - Fitch Memory Controller 1": 0x8f,
  "FMC - Fitch Memory Controller 2": 0x90,
  "OSS - IIfx Operating System Support Chip 1": 0x91,
  "OSS - IIfx Operating System Support Chip 2": 0x92,
  "RPU - Tests the RAM Parity Unit used in 840av": 0x93,
  "Egret - Tests the Egret by executing its built in diagnostics": 0x94,
  "SoundInts - Checks that sound interrupts are working properly": 0x95,
  "CLUT - Tests the Color Lookup Table (LC, Q700/Q900, LC III)": 0x96,
  "VRAM - Tests VRAM (V8 controller)": 0x97,
  "Classic II PWM": 0x98,
  "Classic II SoundInts": 0x99,
  "53C96 SCSI": 0x9a,
  "SONIC ethernet 1": 0x9b,
  "SONIC ethernet 2": 0x9c,
  "SONIC ethernet 3": 0x9d,
  "GSCRegs - Tests Grayscale Chip registers": 0x9e,
  "PGE - Tests PG&E power manager (PowerBook Duo)": 0x9f,
  "CSCRegs - Test Color Support Chip registers": 0xa0,
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

  public async readMemory(
    address: number,
    byteCount: number = 1,
  ): Promise<number[]> {
    await this.startConversation();
    await this.command(COMMANDS.LoadData, ...splitNumberTwoBytes(address));
    await this.command(COMMANDS.ByteCount, byteCount);
    const result = (await this.command(COMMANDS.MemDump)) || "";
    this.stopConversation();
    const bytes =
      result
        .substring(2)
        .substring(0, 2 * byteCount)
        .match(/.{2}/g)
        ?.map(hexToNumber) ?? [];
    if (bytes.length !== byteCount || bytes.some((b) => Number.isNaN(b))) {
      throw new Error(`Unexpected memory dump response: "${result}"`);
    }
    return bytes;
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

  public async nonCriticalTest(
    testNumber: number,
    numberOfAttempts: number = 1,
  ) {
    const flags = 1;
    await this.startConversation();
    await this.command(
      COMMANDS.NonCriticalTest,
      testNumber,
      numberOfAttempts,
      flags,
    );
    this.stopConversation();
  }

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
    } else if (waitFor && waitFor === "*M") {
      const nextResult = await this.serial.waitForResponse(result);
      return nextResult;
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
