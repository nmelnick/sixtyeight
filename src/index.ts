import fs from "node:fs";
import readline from "node:readline/promises";
import { parseArgs } from "./cli.js";
import { Config } from "./config.js";
import { Logger } from "./logger.js";
import { SerialConnection } from "./serial.js";
import { NonCriticalTests, TechStep } from "./techstep.js";
import { Tester } from "./tester.js";
import { ActivityLog } from "./tui/activity-log.js";
import { CardStack, type StatusProvider } from "./tui/card-stack.js";
import { EventLog } from "./tui/event-log.js";
import { HexViewCard } from "./tui/hex-view-card.js";
import { MenuCard, type MenuItem } from "./tui/menu-card.js";
import { MonitorCard } from "./tui/monitor-card.js";
import { Screen } from "./tui/screen.js";
import { Eventer } from "./eventer.js";
import { hexToNumber, numberToHex } from "./convert.js";
import { checkCapability } from "./capabilities.js";

process.on("unhandledRejection", (reason) => {
  Logger.error(
    `Unhandled rejection: ${reason instanceof Error ? reason.message : String(reason)}`,
  );
});

process.on("uncaughtException", (error) => {
  Logger.error(`Uncaught exception: ${error.message}`);
});

async function promptForSerialPort(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const answer = await rl.question(
      `No sixtyeight.config.json found. Enter the serial port device path [${Config.serialPort}]: `,
    );
    return answer.trim() || Config.serialPort;
  } finally {
    rl.close();
  }
}

async function resolveConfig(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.port) {
    Config.serialPort = args.port;
    Config.save();
    return;
  }

  if (Config.exists()) {
    Config.load();
    return;
  }

  Config.serialPort = await promptForSerialPort();
  Config.save();
}

async function go() {
  await resolveConfig();

  const serial = new SerialConnection();
  const ts = new TechStep(serial);
  const tester = new Tester(ts);

  let connected = false;
  let machineType: string | undefined;
  let machineIdentifier: string = "";

  const status: StatusProvider = {
    isConnected: () => connected,
    getPort: () => Config.serialPort,
    getLastStatus: () => ts.lastStatus,
    getLastError: () => ts.lastError,
    getMachineIdentity: () => machineType,
  };

  const activityLog = new ActivityLog(0, 0, 0, 0);

  const eventLog = new EventLog(0, 0, 0, 0);

  // eslint-disable-next-line prefer-const -- mainMenu's closures capture cardStack before it exists (circular reference)
  let cardStack: CardStack;
  let busy = false;
  const isBusy = () => busy;

  async function runCommand(
    label: string,
    fn: () => Promise<void>,
  ): Promise<void> {
    busy = true;
    Logger.log(`Running ${label}...`);
    try {
      await fn();
    } catch (e) {
      Logger.error(
        `${label} failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      busy = false;
    }
  }

  function createAddressRangeMenu(
    title: string,
    runLabel: string,
    defaultStart: number,
    defaultEnd: number,
    run: (start: number, end: number) => Promise<void>,
  ): MenuCard {
    let start = defaultStart;
    let end = defaultEnd;

    const items: MenuItem[] = [
      {
        key: "S",
        label: "Start Address",
        column: 0,
        field: {
          getValue: () => numberToHex(start, 8),
          onSubmit: (value) => {
            const parsed = hexToNumber(value);
            if (!Number.isNaN(parsed)) {
              start = parsed;
            }
          },
        },
      },
      {
        key: "E",
        label: "End Address",
        column: 0,
        field: {
          getValue: () => numberToHex(end, 8),
          onSubmit: (value) => {
            const parsed = hexToNumber(value);
            if (!Number.isNaN(parsed)) {
              end = parsed;
            }
          },
        },
      },
      {
        key: "R",
        label: "Run",
        column: 0,
        onSelect: () => runCommand(runLabel, () => run(start, end)),
      },
    ];

    return new MenuCard(title, 0, 0, 60, 8, items, {
      onPush: (card) => cardStack.push(card),
      onPop: () => cardStack.pop(),
      isBusy,
    });
  }

  const MAX_MONITOR_ADDRESSES = 16;
  const MONITOR_ADDRESS_MAX_LENGTH = 8;

  function addressesInRange(
    start: number,
    end: number,
    maxCount: number,
  ): number[] {
    const span = end - start;
    if (span < 0) {
      return [];
    }
    const total = span + 1;
    if (total <= maxCount) {
      return Array.from({ length: total }, (_, i) => start + i);
    }
    const step = span / (maxCount - 1);
    const addresses = new Set<number>();
    for (let i = 0; i < maxCount; i++) {
      addresses.add(Math.round(start + step * i));
    }
    return [...addresses].sort((a, b) => a - b);
  }

  function createMemoryMonitorConfig(): MenuCard {
    let start = 0;
    let end = 0;
    let intervalSeconds = 30;

    const items: MenuItem[] = [
      {
        key: "S",
        label: "Start Address",
        column: 0,
        field: {
          getValue: () => numberToHex(start, 8),
          maxLength: MONITOR_ADDRESS_MAX_LENGTH,
          onSubmit: (value) => {
            const parsed = hexToNumber(value);
            if (!Number.isNaN(parsed)) {
              start = parsed;
            }
          },
        },
      },
      {
        key: "E",
        label: "End Address",
        column: 0,
        field: {
          getValue: () => numberToHex(end, 8),
          maxLength: MONITOR_ADDRESS_MAX_LENGTH,
          onSubmit: (value) => {
            const parsed = hexToNumber(value);
            if (!Number.isNaN(parsed)) {
              end = parsed;
            }
          },
        },
      },
      {
        key: "I",
        label: "Interval (seconds)",
        column: 0,
        field: {
          getValue: () => String(intervalSeconds),
          onSubmit: (value) => {
            const parsed = parseInt(value, 10);
            if (!Number.isNaN(parsed) && parsed > 0) {
              intervalSeconds = parsed;
            }
          },
        },
      },
      {
        key: "R",
        label: "Start",
        column: 0,
        onSelect: () => {
          const addresses = addressesInRange(start, end, MAX_MONITOR_ADDRESSES);
          cardStack.push(
            new MonitorCard(addresses, intervalSeconds, ts, () =>
              cardStack.pop(),
            ),
          );
        },
      },
    ];

    return new MenuCard("Memory Monitor", 0, 0, 60, 8, items, {
      onPush: (card) => cardStack.push(card),
      onPop: () => cardStack.pop(),
      isBusy,
    });
  }

  const filename = `sixtyeight-${new Date().toISOString().replace("T", "_").replace("Z", "").replace(":", "-")}.log`;
  const logStream = fs.createWriteStream(filename);

  Logger.onAppend((line) => logStream.write(line + "\n"));
  Logger.log("Connecting...");
  await serial.send("\r\n");
  connected = true;
  await runCommand("Get Status", async () => {
    const [statusValue, errorValue] = await ts.getReturnStatus();
    Logger.log(`Status: ${statusValue}, Error: ${errorValue}`);
  });
  await runCommand("Identify Machine", async () => {
    const banner = await ts.banner();
    machineType = banner.machineType ?? banner.identifier;
    machineIdentifier = banner.identifier;
    Logger.log(`Machine: ${machineType}`);
  });

  const criticalTestItems: MenuItem[] = (
    [
      {
        key: "1",
        label: "Size Memory",
        column: 0,
        onSelect: () => runCommand("Size Memory", () => tester.sizeMemory()),
      },
      {
        key: "2",
        label: "Data Bus Test",
        column: 0,
        submenu: () =>
          createAddressRangeMenu(
            "Data Bus Test",
            "Data Bus Test",
            0,
            1024,
            (start, end) => tester.dataBusTest(start, end),
          ),
      },
      {
        key: "3",
        label: "Mod3 RAM Test",
        column: 0,
        submenu: () =>
          createAddressRangeMenu(
            "Mod3 RAM Test",
            "Mod3 RAM Test",
            0,
            8388608,
            (start, end) => tester.mod3RamTest(start, end),
          ),
      },
      {
        key: "4",
        label: "Address Line Test",
        column: 0,
        onSelect: () =>
          runCommand("Address Line Test", () =>
            tester.addressLineTest(8388607),
          ),
      },
      {
        key: "5",
        label: "ROM checksum",
        column: 0,
        onSelect: () => runCommand("ROM checksum", () => tester.romChecksum()),
      },
      {
        key: "6",
        label: "RevMod3 RAM Test",
        column: 0,
        submenu: () =>
          createAddressRangeMenu(
            "RevMod3 RAM Test",
            "RevMod3 RAM Test",
            0,
            8388608,
            (start, end) => tester.revMod3Test(start, end),
          ),
      },
      {
        key: "7",
        label: "Extra RAM Test/March Test",
        column: 1,
        submenu: () =>
          createAddressRangeMenu(
            "Extra RAM Test",
            "Extra RAM Test",
            0,
            8388608,
            (start, end) => tester.extraRamTest(start, end),
          ),
      },
      {
        key: "8",
        label: "ModInv RAM Test",
        column: 1,
        submenu: () =>
          createAddressRangeMenu(
            "ModInv RAM Test",
            "ModInv RAM Test",
            0,
            8388608,
            (start, end) => tester.modInvramTest(start, end),
          ),
      },
      {
        key: "9",
        label: "Size Video RAM Test",
        column: 1,
        onSelect: () =>
          runCommand("Size Video RAM Test", () => tester.sizeVideoRamTest()),
      },
    ] satisfies MenuItem[]
  ).map((item) => {
    return {
      ...item,
      enabled: () =>
        Config.ignoreCapabilityDimming ||
        checkCapability("critical", item.label, machineIdentifier),
    };
  });

  const nonCriticalTestItems: MenuItem[] = Object.keys(NonCriticalTests).map(
    (testName, index) => ({
      key: index < 10 ? index.toString() : String.fromCharCode(97 - 10 + index),
      label: testName,
      column: index > Object.keys(NonCriticalTests).length / 2 ? 1 : 0,
      enabled: () =>
        Config.ignoreCapabilityDimming ||
        checkCapability("nonCritical", testName, machineIdentifier),
      onSelect: () =>
        runCommand(testName, () =>
          tester.nonCriticalTest(NonCriticalTests[testName]),
        ),
    }),
  );

  const settingsItems: MenuItem[] = [
    {
      key: "P",
      label: "Serial port",
      field: {
        getValue: () => Config.serialPort,
        onSubmit: (value) => {
          Config.serialPort = value;
          Config.save();
          Logger.log(`Serial port set to "${value}"`);
        },
      },
    },
    {
      key: "I",
      label: `Ignore capability dimming: ${Config.ignoreCapabilityDimming ? "On" : "Off"}`,
      onSelect: () => {
        Config.ignoreCapabilityDimming = !Config.ignoreCapabilityDimming;
        Config.save();
        settingsItems[1].label = `Ignore capability dimming: ${Config.ignoreCapabilityDimming ? "On" : "Off"}`;
        Logger.log(
          `Ignore capability dimming: ${Config.ignoreCapabilityDimming ? "On" : "Off"}`,
        );
      },
    },
  ];

  const utilityItems: MenuItem[] = [
    {
      key: "1",
      label: "Memory Monitor",
      submenu: () => createMemoryMonitorConfig(),
    },
    {
      key: "2",
      label: "View Memory",
      submenu: () => new HexViewCard(ts, 0, () => cardStack.pop()),
    },
  ];

  const mainMenuItems: MenuItem[] = (
    [
      {
        key: "1",
        label: "Get Status",
        onSelect: () =>
          runCommand("Get Status", async () => {
            const [statusValue, errorValue] = await ts.getReturnStatus();
            Logger.log(`Status: ${statusValue}, Error: ${errorValue}`);
          }),
      },
      {
        key: "2",
        label: "Critical Tests",
        submenu: () =>
          new MenuCard("Critical Tests", 0, 0, 76, 14, criticalTestItems, {
            onPush: (card) => cardStack.push(card),
            onPop: () => cardStack.pop(),
            isBusy,
          }),
      },
      {
        key: "3",
        label: "Non-Critical Tests",
        submenu: () =>
          new MenuCard(
            "Non-Critical Tests",
            0,
            0,
            74,
            6,
            nonCriticalTestItems,
            {
              onPush: (card) => cardStack.push(card),
              onPop: () => cardStack.pop(),
              isBusy,
            },
          ),
      },
      {
        key: "4",
        label: "Utilities",
        submenu: () =>
          new MenuCard("Utilities", 0, 0, 60, 6, utilityItems, {
            onPush: (card) => cardStack.push(card),
            onPop: () => cardStack.pop(),
            isBusy,
          }),
      },
      {
        key: "5",
        label: "Settings",
        submenu: () =>
          new MenuCard("Settings", 0, 0, 60, 6, settingsItems, {
            onPush: (card) => cardStack.push(card),
            onPop: () => cardStack.pop(),
            isBusy,
          }),
      },
      {
        key: "6",
        label: "Clear Result",
        onSelect: () =>
          runCommand("Clear Result", async () => {
            await ts.clearResult();
            const [statusValue, errorValue] = await ts.getReturnStatus();
            Logger.log(`Status: ${statusValue}, Error: ${errorValue}`);
            Eventer.submit({
              name: "Clear Result",
              result: numberToHex(statusValue, 8),
              status: "Success",
            });
          }),
      },
      {
        key: "7",
        label: "Get Version",
        onSelect: () =>
          runCommand("Get Version", async () => {
            await ts.version();
            const [statusValue, errorValue] = await ts.getReturnStatus();
            Logger.log(`Status: ${statusValue}, Error: ${errorValue}`);
            Eventer.submit({
              name: "Get Version",
              result: numberToHex(statusValue, 8),
              status: "Success",
            });
          }),
      },
    ] satisfies MenuItem[]
  ).map((item) => {
    return {
      ...item,
      enabled: () =>
        Config.ignoreCapabilityDimming ||
        checkCapability("command", item.label, machineIdentifier),
    };
  });

  const mainMenu = new MenuCard("Main Menu", 0, 0, 0, 0, mainMenuItems, {
    onPush: (card) => cardStack.push(card),
    onPop: () => cardStack.pop(),
    isBusy,
  });

  cardStack = new CardStack(mainMenu, activityLog, eventLog, status);

  const screen = new Screen(cardStack);
  screen.start();
  screen.render();
}

void go();
