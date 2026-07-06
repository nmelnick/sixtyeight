import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

type TechStepCommand = 'V' | 'S' | 'A' | 'H' | 'R' | 'T' | 'N' | 'L' | 'B' | 'D' | 'M' | 'C' | 'G' | '0' | '1' | '2' | '3' | '2' | '3' | '4' | '5' | '6' | '7' | 'P' | 'E' | 'I' | 'W' | 'Q' | 'U' | 'Z';

const COMMANDS: Record<string,TechStepCommand> = {
  AsciiMode: 'A',
  HexMode: 'H',

  Version: 'V',
  ReturnStatus: 'R',

  CriticalTest: 'T',
  NonCriticalTest: 'N',

  LoadData: 'L',
  ByteCount: 'B',
  GetData: 'D',
  CheckSum: 'C',

  LoadA0: '0',
  LoadA1: '1',

  ClearResult: '4',

  StartBootMsg: '5',
  StopBanner: 'S',
};

const MACHINE_TYPES: Record<string,string> = {
  '1': 'Mac II(256kb ROM family, includes SE/30)',
  '2': 'SE',
  '3': 'Plus (Not likely to have any test mode)',
  '4': 'LaserWriter NTX',
  '5': 'LaserWriter NT',
  '6': 'Portable',
  '7': 'Mac IIci',
  '8': 'IIfx',
  '9': 'LaserWriter SC',
  'A': 'IIci',
  'B': 'Classic',
  'C': 'IIsi',
  'D': 'LC',
  'E': 'Quadra 900',
  'F': 'LaserWriter IIg',
  'G': 'LaserWriter IIf',
  'H': 'PowerBook 170',
  'I': 'Quadra 700',
  'J': 'Classic II',
  'K': 'PowerBook 100 (Unreleased ROM?)',
  'L': 'PowerBook 140',
  'M': 'Quadra 950',
  'N': 'LC III',
  'O': 'Indicates the IIvx family like IIvi, P600',
  'Q': 'Centris 650',
  'R': 'Color Classic',
  'T': 'PowerBook 180',
  'X': 'LC II',
  'e': 'IIvi',
  'f': 'IIvx',
  'j': 'Color Classic',
  'k': 'PowerBook 165c',
  'o': 'PowerBook 145',
};

export enum TestFlag {
  STOP_ON_FIRST_FAILURE = 0x12,
  LOOP_ON_FAILURE_FOREVER = 0x13,
  STORE_TEST_RESULTS_IN_PRAM = 0x14,
  BOOT_AFTER_TEST_IS_DONE = 0x15,
};

export interface BannerResult {
  status: number;
  error: number;
  identifier: string;
  machineType?: string | undefined;
}

export class TechStep {
  private connection: SerialPort;
  private userRequestedCancel: boolean = false;

  public inUse: boolean = false;

  constructor(connection: SerialPort) {
    this.connection = connection;
  }

  public async cancel() {
    if (this.inUse) {
      this.userRequestedCancel = true;
    }
  }

  public async ascii() {
    this.startConversation();
    const result = await this.command(COMMANDS.AsciiMode);
    this.stopConversation();
    return result;
  }

  public async version() {
    this.startConversation();
    const result = await this.command(COMMANDS.Version);
    this.stopConversation();
    return result;
  }

  public async banner() {
    this.startConversation();
    await this.command(COMMANDS.StartBootMsg);
    const banner = await this.waitForBanner();
    await this.command(COMMANDS.StopBanner);
    this.stopConversation();
    await this.ascii();
    return this.parseBanner(banner);
  }

  public async getReturnStatus(): Promise<[number, number]> {
    this.startConversation();
    const result = await this.command(COMMANDS.ReturnStatus);
    this.stopConversation();
    return this.parseResult(result || '');
  }

  public criticalTest = {
    sizeMemory: async (numberOfAttempts: number = 1, testFlags?: TestFlag[]) => {
      this.startConversation();
      await this.runCriticalTest(0, numberOfAttempts, testFlags);
      this.stopConversation();
    },
    dataBusTest: async(startAddress: number, numberOfAttempts: number = 1, testFlags?: TestFlag[]) => {
      this.startConversation();
      const [ address1, address2 ] = startAddress.toString(16).padStart(8, '0').match(/.{4}/g) || ['',''];
      await this.command(COMMANDS.LoadA0, parseInt(address1), parseInt(address2));
      await this.runCriticalTest(1, numberOfAttempts, testFlags);
      this.stopConversation();
    }
  };

  private async runCriticalTest(testNumber: number, numberOfAttempts: number, testFlags?: TestFlag[]) {
    let flags = 1;
    // TODO: Flag operations require research.
    // if (testFlags) {
    //   for (const flag of testFlags) {
    //     flags = flags | 1 << flag;
    //   }
    // } else {
    //   flags = 1;
    // }
    return await this.command(COMMANDS.CriticalTest, testNumber, numberOfAttempts, flags);
  }

  private parseBanner(banner: string): BannerResult {
    if (!banner.startsWith('*APPLE*')) {
      console.error(`Invalid banner: ${banner}`);
      throw new Error('Invalid banner');
    }
    const [ b, a, result, identifier ] = banner.split('*');
    const [ status, error ] = this.parseResult(result as string);
    return {
      status: status,
      error: error,
      identifier: identifier as string,
      machineType: MACHINE_TYPES[identifier as string],
    }
  }

  private parseResult(result: string): [number,number] {
    return [parseInt(result.substring(0, 8), 16), parseInt(result.substring(8), 16)];
  }

  private async waitForBanner(): Promise<string> {
    return new Promise((resolve, reject) => {
      const onError = (error: any) => {
        this.connection.off('error', onError);
        console.error(error);
        reject(error);
      };
      const onData = (line: string) => {
        waiter.off('data', onData);
        console.log(`Received: ${line}`);
        if (line.indexOf('APPLE') > -1) {
          return resolve(line);
        }
        return reject();
      };

      const waiter = this.connection.pipe(new ReadlineParser({ delimiter: '\r' }));
      waiter.on('data', onData);
    });
  }

  private async command(letter: TechStepCommand, word1?: number, word2?: number, word3?: number): Promise<string | void> {
    const prefix = ['*', letter].join('');
    let words = '';
    for (const word of [word1, word2, word3]) {
      if (word != null) {
        words = words + word.toString(16).padStart(4, '0');
      }
    }
    const ascii = [prefix, words].join('');
    return await this.executeSerial(ascii, prefix);
  }

  private async executeSerial(command: string, waitFor?: string): Promise<string | void> {
    return new Promise(async (resolve, reject) => {
      const onError = (error: any) => {
        this.connection.off('error', onError);
        console.error(error);
        reject(error);
      };
      const onData = (line: string) => {
        console.log(`Received: "${line}"`);
        waiter.off('data', onData);
        if (waitFor && line === waitFor) {
          return resolve();
        } else if (waitFor && line.indexOf('ERROR') > -1) {
          return reject(line);
        }
        return resolve(line);
      };

      this.connection.on('error', onError);
      const waiter = this.connection.pipe(new ReadlineParser({ delimiter: '\r\n' }));
      waiter.on('data', onData);
      await this.write(command);
    });
  }

  private startConversation() {
    while (this.inUse) {
    }
    this.inUse = true;
  }

  private stopConversation() {
    this.inUse = false;
    this.userRequestedCancel = false;
  }

  private async checkCancel(): Promise<void> {
    if (this.inUse && this.userRequestedCancel) {
      throw new Error('User cancel');
    }
  }

  private async write(output: string): Promise<void> {
    await sleep(200);
    console.log(`Writing: ${output}`);
    for (const c of output.split('')) {
      // console.log(` - Outputting ${c}`);
      this.connection.write(c);
      await sleep(10);
    }
  }
}
