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
    console.log(`Test result: ${status.toString(16).padStart(8, '0')}`);
  }
}