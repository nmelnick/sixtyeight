import { numberToHex } from "./convert.js";
import { SerialConnection } from "./serial.js";
import { TechStep } from "./techstep.js";
import { Tester } from "./tester.js";

async function go() {
  console.log('Connecting...');
  const serial = new SerialConnection();
  serial.send('\r');
  const ts = new TechStep(serial);
  const tester = new Tester(ts);

  console.log();
  console.log('ASCII mode:');
  await ts.ascii();
  console.log(await ts.getReturnStatus());
  console.log(statusLine(ts));

  console.log();
  console.log('Identify:');
  console.log(await ts.banner());
  console.log(statusLine(ts));

  console.log();
  console.log('Memory size:');
  try {
    await tester.sizeMemory();
  } catch (e) {
    console.error(`Error: ${e}`);
    console.log(await ts.getReturnStatus());
  }
  console.log(statusLine(ts));

  console.log();
  console.log('Data bus:');
  try {
    await tester.dataBusTest(0, 1);
  } catch (e) {
    console.error(`Error: ${e}`);
    console.log(await ts.getReturnStatus());
  }
  console.log(statusLine(ts));

  console.log();
  console.log('Mod3 RAM Test:');
  try {
    await tester.mod3RamTest(0, 8388608);
  } catch (e) {
    console.error(`Error: ${e}`);
    console.log(await ts.getReturnStatus());
  }
  console.log(statusLine(ts));

  console.log();
  console.log('Address Line Test:');
  try {
    await tester.addressLineTest(8388607);
  } catch (e) {
    console.error(`Error: ${e}`);
    console.log(await ts.getReturnStatus());
  }
  console.log(statusLine(ts));

  console.log();
  console.log('ROM Checksup Test:');
  try {
    await tester.romChecksum();
  } catch (e) {
    console.error(`Error: ${e}`);
    console.log(await ts.getReturnStatus());
  }
  console.log(statusLine(ts));
}

function statusLine(ts: TechStep): string {
  return `Last status: ${ts.lastStatus} (${numberToHex(ts.lastStatus, 8)})` +
    '  ' +
    `Last error: ${ts.lastError} (${numberToHex(ts.lastError)})`;
}

go();
