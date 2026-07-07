import { numberToHex } from "./convert.js";
import { Logger } from "./logger.js";
import { TechStep } from "./techstep.js";

export class Tester {
  private techstep: TechStep;

  constructor(techstep: TechStep) {
    this.techstep = techstep;
  }

  public async sizeMemory() {
    await this.techstep.criticalTest.sizeMemory();
    const [status] = await this.techstep.getReturnStatus();
    Logger.log(`Memory size: ${status / 1024}k`);
  }

  public async dataBusTest(
    startAddress: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for API symmetry with mod3RamTest; not forwarded to TechStep yet
    endAddress: number,
  ) {
    await this.techstep.criticalTest.dataBusTest(startAddress);
    const [status] = await this.techstep.getReturnStatus();
    Logger.log(`Test result: ${numberToHex(status)}`);
  }

  public async mod3RamTest(startAddress: number, endAddress: number) {
    await this.techstep.criticalTest.mod3RamTest(startAddress, endAddress);
    const [status] = await this.techstep.getReturnStatus();
    Logger.log(`Test result: ${numberToHex(status)}`);
  }

  public async addressLineTest(memorySize: number) {
    await this.techstep.criticalTest.addressLineTest(memorySize);
    const [status] = await this.techstep.getReturnStatus();
    Logger.log(`Test result: ${numberToHex(status)}`);
  }

  public async romChecksum() {
    await this.techstep.criticalTest.romChecksum();
    const [status] = await this.techstep.getReturnStatus();
    Logger.log(`Test result: ${numberToHex(status)}`);
  }

  public async revMod3Test(startAddress: number, endAddress: number) {
    await this.techstep.criticalTest.revMod3Test(startAddress, endAddress);
    const [status] = await this.techstep.getReturnStatus();
    Logger.log(`Test result: ${numberToHex(status)}`);
  }

  public async extraRamTest(startAddress: number, endAddress: number) {
    await this.techstep.criticalTest.extraRamTest(startAddress, endAddress);
    const [status] = await this.techstep.getReturnStatus();
    Logger.log(`Test result: ${numberToHex(status)}`);
  }

  public async modInvramTest(startAddress: number, endAddress: number) {
    await this.techstep.criticalTest.modInvramTest(startAddress, endAddress);
    const [status] = await this.techstep.getReturnStatus();
    Logger.log(`Test result: ${numberToHex(status)}`);
  }

  public async sizeVideoRamTest() {
    await this.techstep.criticalTest.sizeVideoRamTest();
    const [status] = await this.techstep.getReturnStatus();
    Logger.log(`Test result: ${numberToHex(status)}`);
  }
}
