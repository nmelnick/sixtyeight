import { numberToHex } from "./convert.js";
import { TechStep } from "./techstep.js";

export class Tester {
  private techstep: TechStep;

  constructor(techstep: TechStep) {
    this.techstep = techstep;
  }

  public async sizeMemory() {
    await this.techstep.criticalTest.sizeMemory();
    const [status, error] = await this.techstep.getReturnStatus();
    console.log(`Memory size: ${status / 1024}k`);
  }

  public async dataBusTest(startAddress: number, endAddress: number) {
    await this.techstep.criticalTest.dataBusTest(startAddress);
    const [status, error] = await this.techstep.getReturnStatus();
    console.log(`Test result: ${numberToHex(status)}`);
  }

  public async mod3RamTest(startAddress: number, endAddress: number) {
    await this.techstep.criticalTest.mod3RamTest(startAddress, endAddress);
    const [status, error] = await this.techstep.getReturnStatus();
    console.log(`Test result: ${numberToHex(status)}`);
  }

  public async addressLineTest(memorySize: number) {
    await this.techstep.criticalTest.addressLineTest(memorySize);
    const [status, error] = await this.techstep.getReturnStatus();
    console.log(`Test result: ${numberToHex(status)}`);
  }

  public async romChecksum() {
    await this.techstep.criticalTest.romChecksum();
    const [status, error] = await this.techstep.getReturnStatus();
    console.log(`Test result: ${numberToHex(status)}`);
  }
}