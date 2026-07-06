import * as Serial from "./serial.js";
import { TechStep } from "./techstep.js";
import { Tester } from "./tester.js";

async function go() {
  const connection = Serial.serialPort;
  connection.write('\r');
  const ts = new TechStep(connection);
  const tester = new Tester(ts);
  await ts.ascii();
  // console.log(await ts.getReturnStatus());
  // console.log(await ts.banner());
  await tester.sizeMemory();
  await tester.dataBusTest(0, 1);
}

go();
