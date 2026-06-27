import { expect, type ConsoleMessage, type Page } from "@playwright/test";

type BrowserConsoleGuardOptions = {
  failOn?: RegExp[];
  ignore?: RegExp[];
};

const defaultFailOn = [
  /hydration/i,
  /DialogContent[\s\S]*(Missing `Description`|aria-describedby)/i,
  /(Missing `Description`|aria-describedby)[\s\S]*DialogContent/i,
];

export function watchBrowserConsole(
  page: Page,
  { failOn = defaultFailOn, ignore = [] }: BrowserConsoleGuardOptions = {},
) {
  const problems: string[] = [];

  page.on("console", (message) => {
    if (message.type() !== "warning" && message.type() !== "error") return;

    const text = message.text();
    if (matchesAny(text, ignore) || !matchesAny(text, failOn)) return;

    problems.push(formatConsoleMessage(message));
  });

  page.on("pageerror", (error) => {
    const text = error instanceof Error ? error.stack ?? error.message : String(error);
    if (matchesAny(text, ignore)) return;

    problems.push(`pageerror: ${text}`);
  });

  return {
    get messages() {
      return [...problems];
    },
    async expectNoErrors() {
      expect(problems).toEqual([]);
    },
  };
}

function matchesAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function formatConsoleMessage(message: ConsoleMessage) {
  return `${message.type()}: ${message.text()}`;
}
