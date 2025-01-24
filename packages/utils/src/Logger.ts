const APP_NAME = "gplayer";

/**
 * @beta
 */
export type WriteFn = (...args: any[]) => void;

class DebuggerWrapper {
  private currentWriter: WriteFn;

  constructor(private writer: WriteFn, public readonly namespace: string, enabled = true) {
    this.currentWriter = enabled ? writer : nullWriter;
  }

  enable() {
    this.currentWriter = this.writer;
  }

  disable() {
    this.currentWriter = nullWriter;
  }

  write = (m: any, ...args: any[]) => {
    const tokens = args.map((_) => "%s");
    if (typeof m === "string" || args.length > 0) {
      tokens.unshift("%s");
    }
    this.currentWriter(`${this.namespace}: ${tokens.join(' ')}`, m, ...args.map(a => JSON.stringify(a)));
  }
}

type Pattern = RegExp;

const currentPatterns: Pattern[] = [];

function parsePattern(pattern: string): Pattern {
  if (pattern === "*") {
    return /.?/;
  }
  return new RegExp("^" + pattern.replace(/\*/g, "[@\\w-]+"), "i");
}

function pass(namespace: string): boolean {
  return currentPatterns.some((p) => p.test(namespace));
}

function nullWriter() {}

/**
 * Logging utility with [debug](https://www.npmjs.com/package/debug)-like API
 * @beta
 */
export class Logger {
  public readonly info: WriteFn;
  public readonly warn: WriteFn;
  public readonly error: WriteFn;
  public readonly debug: WriteFn;

  private static items: DebuggerWrapper[] = [];

  constructor(namespace: string, appName = APP_NAME) {
    const ns = namespace ? `:${namespace}` : "";

    const info = new DebuggerWrapper(console.info.bind(console), `${appName}:INFO${ns}`, pass(namespace));
    this.info = info.write;
    
    const warn = new DebuggerWrapper(console.warn.bind(console), `${appName}:WARN${ns}`, pass(namespace));
    this.warn = warn.write;
    
    const error = new DebuggerWrapper(console.error.bind(console), `${appName}:ERROR${ns}`, pass(namespace));
    this.error = error.write;
    
    const debug = new DebuggerWrapper(console.debug.bind(console), `${appName}:DEBUG${ns}`, pass(namespace));
    this.debug = debug.write;

    Logger.items.push(warn);
    Logger.items.push(info);
    Logger.items.push(error);
    Logger.items.push(debug);
  }

  /**
   * @param patterns - comma-separated list of patterns, can contain '*' as a wildcard
   */
  static enable(patterns: string) {
    currentPatterns.splice(
      0,
      currentPatterns.length,
      ...patterns.split(",").filter(Boolean).map(parsePattern),
    );
    Logger.toggleItems();
  }

  static disable() {
    currentPatterns.splice(0, currentPatterns.length);
  }

  private static toggleItems() {
    for (const w of Logger.items) {
      if (pass(w.namespace)) {
        w.enable();
      } else {
        w.disable();
      }
    }
  }
}
