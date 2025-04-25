// src/index.ts

// --- Type Definitions --- (No changes)
export type ArgDefinition = { type: 'string' | 'number' | 'boolean'; alias?: string; description?: string; default?: string | number | boolean; };
export type CliConfig = Record<string, ArgDefinition | boolean>;
type InferArgType<T extends ArgDefinition | boolean> = T extends { type: 'number'; default: number } ? number : T extends { type: 'number' } ? number | undefined : T extends { type: 'boolean'; default: boolean } ? boolean : T extends { type: 'boolean' } ? boolean : T extends true ? boolean : T extends { type: 'string'; default: string } ? string : T extends { type: 'string' } ? string | undefined : string | undefined;
export type ParsedArgs<T extends CliConfig> = { [K in keyof T]: InferArgType<T[K]>; } & { _: string[] };
type ArgConfigWithName = ArgDefinition & { name: string };
type AliasesMap = Record<string, string>;

// --- Internal Helper Functions --- (No changes)
function buildAliasMap(config: CliConfig): AliasesMap { /* ... */
  const map: AliasesMap = {};
  for (const name in config) {
    const def = config[name];
    if (typeof def === 'object' && def.alias) {
      if (map[def.alias]) { console.warn(`Warning: Alias '${def.alias}' is already mapped to '${map[def.alias]}'. Overwriting with mapping to '${name}'.`); }
      if (def.alias.length !== 1) { console.warn(`Warning: Alias '${def.alias}' for option '${name}' is not a single character. Short aliases should be single characters.`); }
      map[def.alias] = name;
    }
  }
  return map;
}
function findArgDefinition(arg: string, config: CliConfig, aliases: AliasesMap): ArgConfigWithName | null | undefined { /* ... */
  if (arg.startsWith('--')) {
    const name = arg.includes('=') ? arg.split('=')[0].slice(2) : arg.slice(2);
    const definition = config[name];
    return definition ? { ...(typeof definition === 'boolean' ? { type: 'boolean' } : definition), name } : undefined;
  } else if (arg.startsWith('-') && arg.length > 1) {
    const alias = arg[1];
    const name = aliases[alias];
    const definition = name ? config[name] : undefined;
    if (definition) {
      if (arg.length > 2 || (typeof definition !== 'boolean' && definition.type !== 'boolean')) { return { ...(typeof definition === 'boolean' ? { type: 'boolean' } : definition), name }; }
      if (arg.length === 2) { return { ...(typeof definition === 'boolean' ? { type: 'boolean' } : definition), name }; }
    }
    if (arg.length > 2) { return null; } // Potential combined flags
    return undefined; // Unknown single char alias
  }
  return undefined;
}
function coerceType(value: string | undefined, type: 'string' | 'number' | 'boolean'): string | number | boolean | undefined { /* ... */
  if (value === undefined) return undefined;
  switch (type) {
    case 'number':
      const num = Number(value);
      if (isNaN(num)) { throw new Error(`Invalid number value: "${value}"`); }
      return num;
    case 'boolean':
      const lowerValue = value.toLowerCase();
      if (lowerValue === 'false' || lowerValue === '0' || lowerValue === 'no') { return false; }
      return true;
    case 'string': default: return value;
  }
}
function generateHelpText(config: CliConfig, scriptName: string = 'script.js'): string { /* ... */
  let help = `Usage: ${scriptName} [options] [...positionals]\n\nOptions:\n`;
  const optionsList: string[] = [];
  const aliasMap = buildAliasMap(config);
  for (const name in config) {
    const definition = config[name];
    const isObjectDefinition = typeof definition === 'object';
    const defType = isObjectDefinition ? definition.type : 'boolean';
    let line = `  `;
    if (isObjectDefinition && definition.alias) { line += `-${definition.alias}, `; }
    line += `--${name}`;
    if (defType !== 'boolean') { line += ` <${defType}>`; }
    const desiredLength = 30;
    line = line.padEnd(desiredLength, ' ');
    if (isObjectDefinition && definition.description) { line += definition.description; }
    if (isObjectDefinition && definition.default !== undefined) { line += ` (default: ${JSON.stringify(definition.default)})`; }
    optionsList.push(line);
  }
  const helpDefined = !!(config.help || Object.keys(aliasMap).find(a => aliasMap[a] === 'help'));
  if (!helpDefined) { optionsList.push(`  -h, --help`.padEnd(30, ' ') + `Show this help message`); }
  help += optionsList.sort().join('\n');
  return help;
}

// --- Main Function ---
export function defineCli<T extends CliConfig>(config: T) {
  const aliases = buildAliasMap(config);
  const helpDefined = !!(config.help || Object.keys(aliases).find(a => aliases[a] === 'help'));
  const helpAlias = Object.keys(aliases).find(a => aliases[a] === 'help');

  return {
    parse(argv: string[] = process.argv.slice(2)): ParsedArgs<T> {
      // --- HELP CHECK (PRIORITY 1) ---
      const wantsHelp = argv.includes('--help') ||
        (helpAlias && argv.includes(`-${helpAlias}`)) ||
        (!helpDefined && argv.includes('-h'));
      if (wantsHelp) {
        const scriptName = process.argv[1] ? process.argv[1].split(/[\\/]/).pop() : 'script.js';
        console.log(generateHelpText(config, scriptName));
        process.exit(0);
      }

      // --- PARSING LOGIC ---
      const result: Record<string, any> = { _: [] };
      let expectingValueFor: ArgConfigWithName | null = null;
      let endedOptions = false;

      // Apply Defaults
      for (const name in config) {
        const definition = config[name];
        if (typeof definition === 'object' && definition.default !== undefined) { result[name] = definition.default; }
        else if (definition === true || (typeof definition === 'object' && definition.type === 'boolean' && definition.default === undefined)) { result[name] = false; }
      }

      try {
        for (let i = 0; i < argv.length; i++) {
          const arg = argv[i];

          // ** FIX: Check endedOptions FIRST **
          // Handle arguments after '--'
          if (endedOptions) {
            result._.push(arg);
            continue;
          }
          // Handle '--' separator itself
          if (arg === '--') {
            endedOptions = true;
            continue;
          }

          // Handle value expected from previous argument
          if (expectingValueFor) {
            if (arg.startsWith('-') && Number.isNaN(Number(arg))) { throw new Error(`Missing value for option: ${expectingValueFor.alias ? `-${expectingValueFor.alias}/` : ''}--${expectingValueFor.name}`); }
            result[expectingValueFor.name] = coerceType(arg, expectingValueFor.type);
            expectingValueFor = null;
            continue;
          }

          // Handle '--option=value'
          if (arg.startsWith('--') && arg.includes('=')) {
            const [key, ...valueParts] = arg.split('=');
            const value = valueParts.join('=');
            const definition = findArgDefinition(key, config, aliases);
            if (!definition) throw new Error(`Unknown option: ${key}`);
            if (definition.type === 'boolean') throw new Error(`Boolean flag '${definition.name}' cannot be assigned a value with '='.`);
            result[definition.name] = coerceType(value, definition.type);
            continue;
          }

          // Handle '-', '-o', '-ovalue', '-oflag', '-abc', '-x'
          if (arg.startsWith('-') && !arg.startsWith('--')) {
            const firstChar = arg[1];
            const rest = arg.slice(2);
            const firstAliasDef = findArgDefinition(`-${firstChar}`, config, aliases);

            if (!firstAliasDef && arg.length === 2) { throw new Error(`Unknown option: -${firstChar}`); }

            if (firstAliasDef && arg.length === 2) {
              if (firstAliasDef.type === 'boolean') { result[firstAliasDef.name] = true; }
              else { expectingValueFor = firstAliasDef; }
              continue;
            }

            if (firstAliasDef && arg.length > 2) {
              if (firstAliasDef.type !== 'boolean') {
                try {
                  result[firstAliasDef.name] = coerceType(rest, firstAliasDef.type);
                  continue;
                } catch (coercionError) { throw new Error(`Invalid value format following option: -${firstChar}`); }
              }
              // Fall through for combined boolean flags starting with a known flag
            }

            if (arg.length >= 2) {
              const combinedChars = arg.slice(1).split('');
              let allFlagsKnownAndBoolean = true;
              for (const char of combinedChars) {
                const name = aliases[char];
                const def = name ? config[name] : undefined;
                if (!def || !(def === true || (typeof def === 'object' && def.type === 'boolean'))) { allFlagsKnownAndBoolean = false; break; }
              }
              if (allFlagsKnownAndBoolean) {
                combinedChars.forEach(char => { result[aliases[char]] = true; });
                continue;
              } else { throw new Error(`Unknown option or invalid combined flags: ${arg}`); }
            }
          } // End of '-' handling

          // Handle '--option' (known long option/flag)
          if (arg.startsWith('--')) {
            const definition = findArgDefinition(arg, config, aliases);
            if (definition) {
              if (definition.type === 'boolean') { result[definition.name] = true; }
              else { expectingValueFor = definition; }
              continue;
            } else { throw new Error(`Unknown option: ${arg}`); }
          }

          // Positional
          result._.push(arg);

        } // End argv loop

        if (expectingValueFor) { throw new Error(`Missing value for option: ${expectingValueFor.alias ? `-${expectingValueFor.alias}/` : ''}--${expectingValueFor.name}`); }

      } catch (error: any) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
      }

      return result as ParsedArgs<T>;
    }
  };
}