# infer-args

[![npm version](https://badge.fury.io/js/infer-args.svg)](https://badge.fury.io/js/infer-args)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Tiny, type-safe CLI argument parser for Node.js with zero runtime dependencies and strong TypeScript type inference.**

## Features

- Parses flags (e.g., `--verbose`, `-v`).
- Parses options with values (e.g., `--port 8080`, `-p 80`, `--file=out.txt`).
- Handles combined short flags (e.g., `-vf`).
- Collects positional arguments (e.g., `my-cli input.txt output.txt`).
- Supports aliases for options and flags.
- Supports default values.
- Strongly types output based on your definition.
- Automatically generates help text (`-h`, `--help`).
- Gracefully handles parsing errors (prints to `stderr` and exits non-zero).
- Respects the `--` separator.
- Zero runtime dependencies.

## Installation

```bash
npm install infer-args
# or
yarn add infer-args
# or
pnpm add infer-args
```

## Usage

```ts
// my-script.ts
import { defineCli } from 'infer-args';

// 1. Define your CLI arguments
const cli = defineCli({
  port: {
    type: 'number',
    alias: 'p',
    default: 8080,
    description: 'Port to listen on',
  },
  verbose: {
    type: 'boolean',
    alias: 'v',
    description: 'Enable verbose logging',
  },
  file: {
    type: 'string',
    alias: 'f',
    description: 'Input file path',
  },
  force: true, // shorthand for a boolean flag
  output: {
    type: 'string',
    description: 'Output file path (optional)',
  },
});

// 2. Parse arguments (defaults to process.argv.slice(2))
const args = cli.parse();

console.log('Arguments:', args);
console.log(`Listening on port: ${args.port}`);
if (!args.file) {
  console.error('Error: Input file is required (--file)');
  process.exit(1);
}
console.log(`Processing file: ${args.file}`);
if (args.verbose) console.log('Verbose mode enabled.');
if (args.force) console.log('Force mode enabled.');
if (args._.length > 0) console.log('Positional arguments:', args._);
```

### Example Invocations

```bash
ts-node my-script.ts --file data.csv
# Arguments: { port: 8080, verbose: false, file: 'data.csv', force: false, output: undefined, _: [] }

ts-node my-script.ts -vf config.json --port=3000 extra positional
# Arguments: { port: 3000, verbose: true, file: 'config.json', force: true, output: undefined, _: ['extra', 'positional'] }

ts-node my-script.ts --help
# Displays usage and exits

ts-node my-script.ts --nonexistent
# Error: Unknown option: --nonexistent

ts-node my-script.ts --port
# Error: Missing value for option: -p/--port
```

## Defining Arguments

Pass a configuration object to `defineCli`. Each key is the argument name. Values can be:

- **ArgDefinition object**:
  - `type`: `'string'`, `'number'`, or `'boolean'`.
  - `alias` (optional): Single character (e.g., `'p'`).
  - `description` (optional): Used in help text.
  - `default` (optional): Value if not provided.
- **`true`**: Shorthand for `{ type: 'boolean' }`.

## Parsing

Call the `.parse()` method on the result of `defineCli`:

- `cli.parse()`: Parses `process.argv.slice(2)` by default.
- `cli.parse(['--myflag', 'value'])`: Parses a custom array.

Automatically handles `-h`/`--help` and exits on errors.

## Accessing Results

The parsed object:

- Has properties matching your config keys.
- Types inferred from `type` and `default`.
- Includes a special `_` property (typed `string[]`) for positional arguments.

## API Reference

```ts
defineCli<T extends CliConfig>(config: T): {
  parse: (argv?: string[]) => ParsedArgs<T>;
};
```

## 🤝 Contributing

Contributions (bug reports, feature requests) are welcome!

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.