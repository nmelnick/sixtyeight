import { SerialPort } from 'serialport';
import { Config } from './config.js';

export const serialPort = new SerialPort({
  path: Config.serialPort,
  baudRate: 9600,
  stopBits: 2,
});
