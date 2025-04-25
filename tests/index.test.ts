// tests/index.test.ts

import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { defineCli } from "../src/index.js";

// Define a type for the expected structure of process.exit mock error
class ExitCalledError extends Error {
  code?: string | number | null | undefined;
  constructor(code?: string | number | null | undefined) {
    super(`process.exit(${code ?? ''}) called.`);
    this.name = 'ExitCalledError';
    this.code = code;
  }
}


describe("infer-args", () => {
  let originalArgv: string[];
  let exitSpy: jest.SpiedFunction<typeof process.exit>;
  let errorSpy: jest.SpiedFunction<typeof console.error>;
  let logSpy: jest.SpiedFunction<typeof console.log>;

  beforeEach(() => {
    originalArgv = [...process.argv];
    // ** FIX: Modify exit mock to throw a specific error **
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(
      (code?: string | number | null | undefined): never => {
        throw new ExitCalledError(code); // Throw error to halt execution
      }
    );
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
  });

  afterEach(() => {
    process.argv = originalArgv;
    jest.restoreAllMocks();
  });

  const mockArgv = (...args: string[]) => {
    process.argv = ["/usr/bin/node", "/home/user/project/script.js", ...args];
  };

  // --- Basic Definition ---
  it("should define a CLI structure and return a parse method", () => { /* ... no change ... */
    const cli = defineCli({ port: { type: "number", default: 8080 }, verbose: true, });
    expect(cli).toHaveProperty("parse");
    expect(typeof cli.parse).toBe("function");
  });

  // --- Flag Parsing ---
  describe("Flag Parsing", () => { /* ... no change needed in tests ... */
    const cli = defineCli({ verbose: { type: 'boolean', alias: 'v' }, force: { type: 'boolean', alias: 'f' }, dryRun: { type: 'boolean', alias: 'd' }, quick: true });
    it("should parse long boolean flags", () => { mockArgv('--verbose'); const args = cli.parse(); expect(args.verbose).toBe(true); expect(args.force).toBe(false); expect(args.dryRun).toBe(false); expect(args.quick).toBe(false); });
    it("should parse short boolean flags", () => { mockArgv('-f'); const args = cli.parse(); expect(args.verbose).toBe(false); expect(args.force).toBe(true); expect(args.dryRun).toBe(false); expect(args.quick).toBe(false); });
    it("should parse combined short boolean flags", () => { mockArgv('-vfd'); const args = cli.parse(); expect(args.verbose).toBe(true); expect(args.force).toBe(true); expect(args.dryRun).toBe(true); expect(args.quick).toBe(false); });
    it("should handle flags mixed with other args", () => { mockArgv('input.txt', '-v', '--force', 'output.txt', '-d'); const args = cli.parse(); expect(args.verbose).toBe(true); expect(args.force).toBe(true); expect(args.dryRun).toBe(true); expect(args._).toEqual(['input.txt', 'output.txt']); });
    it("should default boolean flags to false if not present", () => { mockArgv(); const args = cli.parse(); expect(args.verbose).toBe(false); expect(args.force).toBe(false); expect(args.dryRun).toBe(false); expect(args.quick).toBe(false); });
    it("should handle boolean flags with explicit default: true", () => { const cliDefaultTrue = defineCli({ flag: { type: 'boolean', default: true } }); mockArgv(); expect(cliDefaultTrue.parse().flag).toBe(true); mockArgv('--flag'); expect(cliDefaultTrue.parse().flag).toBe(true); });
  });

  // --- Option Parsing ---
  describe("Option Parsing", () => { /* ... no change needed in tests ... */
    const cli = defineCli({ port: { type: 'number', alias: 'p' }, file: { type: 'string', alias: 'f' }, level: { type: 'string', default: 'info' }, retries: { type: 'number', default: 3 } });
    it("should parse long options with space separator", () => { mockArgv('--port', '3000', '--file', 'config.json'); const args = cli.parse(); expect(args.port).toBe(3000); expect(args.file).toBe('config.json'); });
    it("should parse long options with = separator", () => { mockArgv('--port=9090', '--file=data.xml'); const args = cli.parse(); expect(args.port).toBe(9090); expect(args.file).toBe('data.xml'); });
    it("should parse short options with space separator", () => { mockArgv('-p', '8000', '-f', 'in.txt'); const args = cli.parse(); expect(args.port).toBe(8000); expect(args.file).toBe('in.txt'); });
    it("should parse short options with adjacent value", () => { mockArgv('-p443', '-fout.log'); const args = cli.parse(); expect(args.port).toBe(443); expect(args.file).toBe('out.log'); });
    it("should apply default values for options", () => { mockArgv('--port', '1234'); const args = cli.parse(); expect(args.port).toBe(1234); expect(args.level).toBe('info'); expect(args.retries).toBe(3); expect(args.file).toBeUndefined(); });
    it("should override default values", () => { mockArgv('--level', 'debug', '--retries', '5'); const args = cli.parse(); expect(args.level).toBe('debug'); expect(args.retries).toBe(5); });
    it("should handle options mixed with flags and positionals", () => { mockArgv('start', '-p', '80', '--file=index.html', 'end', '-v'); const cliWithFlag = defineCli({ port: { type: 'number', alias: 'p' }, file: { type: 'string', alias: 'f' }, verbose: { type: 'boolean', alias: 'v' } }); const args = cliWithFlag.parse(); expect(args.port).toBe(80); expect(args.file).toBe('index.html'); expect(args.verbose).toBe(true); expect(args._).toEqual(['start', 'end']); });
    it("should handle option values that look like numbers but are strings", () => { mockArgv('--level', '123'); const args = cli.parse(); expect(args.level).toBe('123'); });
    it("should handle option values that contain '='", () => { mockArgv('--file=path=with=equals.txt'); const args = cli.parse(); expect(args.file).toBe('path=with=equals.txt'); });
  });

  // --- Positional & -- Separator ---
  describe("Positional Arguments and -- Separator", () => { /* ... no change needed in tests ... */
    const cli = defineCli({ verbose: true, port: { type: 'number', alias: 'p' } });
    it("should collect positional arguments in _", () => { mockArgv('file1.txt', '--verbose', 'file2.txt', '-p', '80'); const args = cli.parse(); expect(args._).toEqual(['file1.txt', 'file2.txt']); expect(args.verbose).toBe(true); expect(args.port).toBe(80); });
    it("should treat arguments after -- as positional, even if they look like flags/options", () => { mockArgv('--verbose', '--', '-p', '8080', '--port', '--', 'foo'); const args = cli.parse(); expect(args.verbose).toBe(true); expect(args.port).toBeUndefined(); expect(args._).toEqual(['-p', '8080', '--port', '--', 'foo']); }); // Re-verify this test
    it("should handle only positional arguments", () => { mockArgv('a', 'b', 'c'); const args = cli.parse(); expect(args._).toEqual(['a', 'b', 'c']); expect(args.verbose).toBe(false); expect(args.port).toBeUndefined(); });
    it("should handle only --", () => { mockArgv('--'); const args = cli.parse(); expect(args._).toEqual([]); expect(args.verbose).toBe(false); });
    it("should handle empty argv", () => { mockArgv(); const args = cli.parse(); expect(args._).toEqual([]); expect(args.verbose).toBe(false); expect(args.port).toBeUndefined(); });
  });

  // --- Type Coercion ---
  describe("Type Coercion", () => {
    const cli = defineCli({
      num: { type: 'number' },
      bool: { type: 'boolean' }, // Defined as boolean flag
      str: { type: 'string' }
    });

    it("should coerce number strings to numbers", () => { /* ... no change ... */
      mockArgv('--num', '123.45'); expect(cli.parse().num).toBe(123.45);
      mockArgv('--num', '-10'); expect(cli.parse().num).toBe(-10);
      mockArgv('--num', '0'); expect(cli.parse().num).toBe(0);
    });

    // Test how the *flag* is set, not coercion of a value it doesn't take
    it("should treat presence of boolean flag as true", () => {
      mockArgv('--bool');
      expect(cli.parse().bool).toBe(true);
    });

    it("should treat absence of boolean flag as false (or default)", () => {
      mockArgv(); // No --bool provided
      expect(cli.parse().bool).toBe(false); // Default for boolean is false

      const cliDefaultTrue = defineCli({ b: { type: 'boolean', default: true } });
      mockArgv();
      expect(cliDefaultTrue.parse().b).toBe(true); // Respects explicit default
    });

    // Remove the previous "false cases" test for coercion, as boolean flags don't coerce values.
    // Instead, test that providing a value after a boolean flag makes it positional.
    it("should treat value after boolean flag as positional", () => {
      mockArgv('--bool', 'false');
      const args = cli.parse();
      expect(args.bool).toBe(true); // Flag presence sets it to true
      expect(args._).toEqual(['false']); // 'false' becomes positional

      mockArgv('--bool', 'true');
      const args2 = cli.parse();
      expect(args2.bool).toBe(true);
      expect(args2._).toEqual(['true']);
    });


    it("should keep strings as strings", () => { /* ... no change ... */
      mockArgv('--str', 'hello'); expect(cli.parse().str).toBe('hello');
      mockArgv('--str', '123'); expect(cli.parse().str).toBe('123');
      mockArgv('--str', ''); expect(cli.parse().str).toBe('');
    });

    it("should throw error for invalid number strings during coercion", () => { /* ... no change ... */
      mockArgv('--num', 'abc');
      expect(() => cli.parse()).toThrow(new ExitCalledError(1));
      expect(errorSpy).toHaveBeenCalledWith('Error: Invalid number value: "abc"');
    });
  });

  // --- Error Handling and Exit ---
  describe("Error Handling and Exit", () => { /* ... no change needed in tests ... */
    const cli = defineCli({ port: { type: 'number', alias: 'p' }, verbose: { type: 'boolean', alias: 'v' }, file: { type: 'string', alias: 'f' } });
    it("should print error and exit(1) for unknown long option", () => { mockArgv('--unknown-option'); expect(() => cli.parse()).toThrow(new ExitCalledError(1)); expect(errorSpy).toHaveBeenCalledWith('Error: Unknown option: --unknown-option'); });
    it("should print error and exit(1) for unknown short option", () => { mockArgv('-x'); expect(() => cli.parse()).toThrow(new ExitCalledError(1)); expect(errorSpy).toHaveBeenCalledWith('Error: Unknown option: -x'); });
    it("should print error and exit(1) for unknown combined short flags", () => { mockArgv('-vx'); expect(() => cli.parse()).toThrow(new ExitCalledError(1)); expect(errorSpy).toHaveBeenCalledWith('Error: Unknown option or invalid combined flags: -vx'); });
    it("should print error and exit(1) if option requiring value is missing it (end of argv)", () => { mockArgv('--port'); expect(() => cli.parse()).toThrow(new ExitCalledError(1)); expect(errorSpy).toHaveBeenCalledWith('Error: Missing value for option: -p/--port'); });
    it("should print error and exit(1) if option requiring value is followed by another known option", () => { mockArgv('--file', '--verbose'); expect(() => cli.parse()).toThrow(new ExitCalledError(1)); expect(errorSpy).toHaveBeenCalledWith('Error: Missing value for option: -f/--file'); });
    it("should print error and exit(1) if option requiring value is followed by --", () => { mockArgv('--file', '--'); expect(() => cli.parse()).toThrow(new ExitCalledError(1)); expect(errorSpy).toHaveBeenCalledWith('Error: Missing value for option: -f/--file'); });
    it("should print error and exit(1) if boolean flag is assigned value with =", () => { mockArgv('--verbose=true'); expect(() => cli.parse()).toThrow(new ExitCalledError(1)); expect(errorSpy).toHaveBeenCalledWith("Error: Boolean flag 'verbose' cannot be assigned a value with '='."); });
    it("should print error and exit(1) for invalid adjacent value combined with flag", () => { mockArgv('-p80v'); expect(() => cli.parse()).toThrow(new ExitCalledError(1)); expect(errorSpy).toHaveBeenCalledWith('Error: Invalid value format following option: -p'); });
    it("should print error and exit(1) for adjacent value on boolean flag", () => { mockArgv('-vtrue'); expect(() => cli.parse()).toThrow(new ExitCalledError(1)); expect(errorSpy).toHaveBeenCalledWith('Error: Unknown option or invalid combined flags: -vtrue'); });
  });

  // --- Help Generation (REQ-HELP-01, REQ-HELP-02, REQ-HELP-03) ---
  describe("Help Generation", () => {
    const cli = defineCli({ port: { type: 'number', alias: 'p', description: 'The port number', default: 80 }, verbose: { type: 'boolean', alias: 'v', description: 'Enable verbose mode' }, file: { type: 'string', description: 'Input file' }, });
    const cliWithHelp = defineCli({ config: { type: 'string', alias: 'c' }, help: { type: 'boolean', alias: 'h', description: 'Show custom help' } });

    it("should implicitly trigger help on --help, print usage, and exit(0)", () => {
      mockArgv('--help');
      // ** FIX: Expect the mock error to be thrown **
      expect(() => cli.parse()).toThrow(new ExitCalledError(0));
      expect(logSpy).toHaveBeenCalledTimes(1); // Check log happened before exit
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('-h, --help'));
      expect(errorSpy).not.toHaveBeenCalled(); // Ensure no error was logged
    });

    it("should implicitly trigger help on -h, print usage, and exit(0)", () => {
      mockArgv('-h');
      // ** FIX: Expect the mock error to be thrown **
      expect(() => cli.parse()).toThrow(new ExitCalledError(0));
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('-h, --help'));
      expect(errorSpy).not.toHaveBeenCalled(); // Should pass now
    });

    it("should trigger explicitly defined help on --help", () => {
      mockArgv('--help');
      // ** FIX: Expect the mock error to be thrown **
      expect(() => cliWithHelp.parse()).toThrow(new ExitCalledError(0));
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Show custom help'));
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it("should trigger explicitly defined help on its alias", () => {
      mockArgv('-h');
      // ** FIX: Expect the mock error to be thrown **
      expect(() => cliWithHelp.parse()).toThrow(new ExitCalledError(0));
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('-h, --help'));
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it("should prioritize help flag even if other args are present", () => {
      mockArgv('--port', '8080', '--help', 'positional');
      // ** FIX: Expect the mock error to be thrown **
      expect(() => cli.parse()).toThrow(new ExitCalledError(0));
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it("should prioritize help flag even if parsing errors would occur otherwise", () => {
      mockArgv('--port', '--help'); // Missing value for port, but help takes precedence
      // ** FIX: Expect the mock error to be thrown **
      expect(() => cli.parse()).toThrow(new ExitCalledError(0));
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).not.toHaveBeenCalled(); // Should pass now
    });
  });

});