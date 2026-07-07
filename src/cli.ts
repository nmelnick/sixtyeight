export interface CliArgs {
  port?: string;
}

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--port') {
      args.port = argv[i + 1];
      i++;
    } else if (arg.startsWith('--port=')) {
      args.port = arg.slice('--port='.length);
    }
  }
  return args;
}
