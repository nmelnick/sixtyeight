import { describe, expect, it } from 'vitest';
import { parseArgs } from './cli.js';

describe('parseArgs', () => {
  it('parses --port with a separate value', () => {
    expect(parseArgs(['--port', '/dev/ttyUSB0'])).toEqual({ port: '/dev/ttyUSB0' });
  });

  it('parses --port=value form', () => {
    expect(parseArgs(['--port=/dev/ttyUSB0'])).toEqual({ port: '/dev/ttyUSB0' });
  });

  it('returns no port when not provided', () => {
    expect(parseArgs([])).toEqual({});
  });

  it('ignores unrelated arguments', () => {
    expect(parseArgs(['--verbose', '--port', '/dev/ttyACM0', '--other', 'x'])).toEqual({ port: '/dev/ttyACM0' });
  });
});
