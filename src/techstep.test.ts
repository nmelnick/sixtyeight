import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { TechStep } from './techstep.js';

class FakeConnection extends EventEmitter {
  public written: string[] = [];
  private piped: any = null;

  pipe(destination: any) {
    this.piped = destination;
    return destination;
  }

  write(data: string) {
    this.written.push(data);
  }

  respond(line: string) {
    this.piped.write(Buffer.from(`${line}\r`));
  }
}

function setup() {
  const connection = new FakeConnection();
  const techStep = new TechStep(connection as any);
  return { connection, techStep };
}

describe('TechStep', () => {
  it('sends the version command and resolves when the device echoes it back', async () => {
    const { connection, techStep } = setup();

    const resultPromise = techStep.version();
    connection.respond('*V');

    await expect(resultPromise).resolves.toBeUndefined();
    expect(connection.written).toEqual(['*V']);
  });

  it('resolves with the device reply when it differs from the echoed command', async () => {
    const { connection, techStep } = setup();

    const resultPromise = techStep.version();
    connection.respond('v1.2.3');

    await expect(resultPromise).resolves.toBe('v1.2.3');
  });

  it('sends the return status command and returns the reply line', async () => {
    const { connection, techStep } = setup();

    const resultPromise = techStep.getReturnStatus();
    connection.respond('0004');

    await expect(resultPromise).resolves.toBe('0004');
    expect(connection.written).toEqual(['*R']);
  });

  it('returns an empty string from getReturnStatus when the command only echoes', async () => {
    const { connection, techStep } = setup();

    const resultPromise = techStep.getReturnStatus();
    connection.respond('*R');

    await expect(resultPromise).resolves.toBe('');
  });

  it('rejects when the connection emits an error', async () => {
    const { connection, techStep } = setup();

    const resultPromise = techStep.version();
    const error = new Error('boom');
    connection.emit('error', error);

    await expect(resultPromise).rejects.toBe(error);
  });
});
