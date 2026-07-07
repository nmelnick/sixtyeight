import readline from "node:readline/promises";
import { parseArgs } from "./cli.js";
import { Config } from "./config.js";
import { Logger } from "./logger.js";
import { SerialConnection } from "./serial.js";
import { TechStep } from "./techstep.js";
import { Tester } from "./tester.js";
import { ActivityLog } from "./tui/activity-log.js";
import { CardStack, type StatusProvider } from "./tui/card-stack.js";
import { MenuCard, type MenuItem } from "./tui/menu-card.js";
import { Screen } from "./tui/screen.js";

async function promptForSerialPort(): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`No sixtyeight.config.json found. Enter the serial port device path [${Config.serialPort}]: `);
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
  let machineIdentity: string | undefined;

  const status: StatusProvider = {
    isConnected: () => connected,
    getPort: () => Config.serialPort,
    getLastStatus: () => ts.lastStatus,
    getLastError: () => ts.lastError,
    getMachineIdentity: () => machineIdentity,
  };

  const activityLog = new ActivityLog(0, 0, 0, 0);

  let cardStack: CardStack;
  let busy = false;
  const isBusy = () => busy;

  async function runCommand(label: string, fn: () => Promise<void>): Promise<void> {
    busy = true;
    Logger.log(`Running ${label}...`);
    try {
      await fn();
    } catch (e) {
      Logger.error(`${label} failed: ${e}`);
    } finally {
      busy = false;
    }
  }

  const criticalTestItems: MenuItem[] = [
    { key: '1', label: 'Size Memory', column: 0, onSelect: () => runCommand('Size Memory', () => tester.sizeMemory()) },
    { key: '2', label: 'Data Bus Test', column: 0, onSelect: () => runCommand('Data Bus Test', () => tester.dataBusTest(0, 1)) },
    { key: '3', label: 'Mod3 RAM Test', column: 0, onSelect: () => runCommand('Mod3 RAM Test', () => tester.mod3RamTest(0, 8388608)) },
    { key: '4', label: 'Address Line Test', column: 0, onSelect: () => runCommand('Address Line Test', () => tester.addressLineTest(8388607)) },
    { key: '5', label: 'ROM checksum', column: 0, onSelect: () => runCommand('ROM checksum', () => tester.romChecksum()) },
    { key: '6', label: 'RevMod3 RAM Test', column: 0, enabled: false },
    { key: '7', label: 'Extra RAM Test/March Test', column: 1, enabled: false },
    { key: '8', label: 'ModInv RAM Test', column: 1, enabled: false },
    { key: '9', label: 'Size Video RAM', column: 1, enabled: false },
  ];

  const settingsItems: MenuItem[] = [
    {
      key: 'P',
      label: 'Serial port',
      field: {
        getValue: () => Config.serialPort,
        onSubmit: (value) => {
          Config.serialPort = value;
          Config.save();
          Logger.log(`Serial port set to "${value}"`);
        },
      },
    },
  ];

  const mainMenuItems: MenuItem[] = [
    {
      key: '1',
      label: 'Get Status',
      onSelect: () =>
        runCommand('Get Status', async () => {
          const [statusValue, errorValue] = await ts.getReturnStatus();
          Logger.log(`Status: ${statusValue}, Error: ${errorValue}`);
        }),
    },
    {
      key: '2',
      label: 'Identify Machine',
      onSelect: () =>
        runCommand('Identify Machine', async () => {
          const banner = await ts.banner();
          machineIdentity = banner.machineType ?? banner.identifier;
          Logger.log(`Machine: ${machineIdentity}`);
        }),
    },
    {
      key: '3',
      label: 'Critical Tests',
      submenu: () =>
        new MenuCard('Critical Tests', 0, 0, 76, 14, criticalTestItems, {
          onPush: (card) => cardStack.push(card),
          onPop: () => cardStack.pop(),
          isBusy,
        }),
    },
    { key: '4', label: 'Non-Critical Tests', enabled: false },
    {
      key: '5',
      label: 'Settings',
      submenu: () =>
        new MenuCard('Settings', 0, 0, 60, 6, settingsItems, {
          onPush: (card) => cardStack.push(card),
          onPop: () => cardStack.pop(),
          isBusy,
        }),
    },
    {
      key: '6',
      label: 'Clear Result',
      onSelect: () =>
        runCommand('Clear Result', async () => {
          await ts.clearResult();
          const [statusValue, errorValue] = await ts.getReturnStatus();
          Logger.log(`Status: ${statusValue}, Error: ${errorValue}`);
        }),
    },
  ];

  const mainMenu = new MenuCard('Main Menu', 0, 0, 0, 0, mainMenuItems, {
    onPush: (card) => cardStack.push(card),
    onPop: () => cardStack.pop(),
    isBusy,
  });

  cardStack = new CardStack(mainMenu, activityLog, status);

  const screen = new Screen(cardStack);
  screen.start();

  Logger.log('Connecting...');
  await serial.send('\r');
  connected = true;
  screen.render();
  await runCommand('Get Status', async () => {
    const [statusValue, errorValue] = await ts.getReturnStatus();
    Logger.log(`Status: ${statusValue}, Error: ${errorValue}`);
  });
  await runCommand('Identify Machine', async () => {
    const banner = await ts.banner();
    machineIdentity = banner.machineType ?? banner.identifier;
    Logger.log(`Machine: ${machineIdentity}`);
  });
}

go();
