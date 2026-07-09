import { numberToHex } from "./convert.js";
import { Eventer } from "./eventer.js";
import { Logger } from "./logger.js";
import { TechStep } from "./techstep.js";

export class Tester {
  private techstep: TechStep;

  constructor(techstep: TechStep) {
    this.techstep = techstep;
  }

  public async sizeMemory() {
    try {
      await this.techstep.criticalTest.sizeMemory();
      const [status] = await this.techstep.getReturnStatus();
      Eventer.submit({
        name: "SizeMemory",
        status: "Success",
        result: `Memory size: ${status / 1024}k`,
      });
    } catch (e: unknown) {
      Eventer.submit({
        name: "SizeMemory",
        status: "Failure",
        result: Error.isError(e) ? e.message : "",
      });
    }
  }

  public async dataBusTest(startAddress: number, endAddress: number) {
    const statusList: Map<number, number> = new Map();
    for (let address = startAddress; address <= endAddress; address += 8) {
      await this.techstep.criticalTest.dataBusTest(address);
      const [status] = await this.techstep.getReturnStatus();
      Logger.log(`Test result: ${numberToHex(status)}`);
      statusList.set(address, status);
    }
    let err = 0;
    for (const k of statusList.keys()) {
      if (statusList.has(k) && (statusList.get(k) as number) > 0) {
        err = statusList.get(k) as number;
      }
    }
    Eventer.submit({
      name: "DataBusTest",
      status: err ? "Failure" : "Success",
      result: numberToHex(err, 8),
    });
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

  public async nonCriticalTest(testNumber: number) {
    await this.techstep.nonCriticalTest(testNumber);
    const [status] = await this.techstep.getReturnStatus();
    Logger.log(`Test result: ${numberToHex(status)}`);
  }
}
