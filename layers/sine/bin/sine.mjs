#!/usr/bin/env node
/**
 * `sine`: Sine's checks for a project that uses it, by hand or in CI.
 *
 * Exits 0 when a check is clean, 1 when it finds something, and 2 when it
 * can't run: an unknown command or option, or a project it can't read.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

const USAGE = `Usage: sine <command> [options]

Commands
  lint      Lint the project against Sine's design rules
  doctor    Check the app is wired to Sine: the layer, its peers, the
            stylesheet, the host's files, the shell, and what replaces Sine

Options
  --root <dir>  The project to check (default: the current directory)
  --list        lint: also print every allowlisted exception
  --json        Print the result as JSON
  -v, --version Print Sine's version
  -h, --help    Print this help

A project's allowlists and accepted checks live in sine.config.{ts,mjs,js,json}
at its root.`;

const fail = (message) => {
  console.error(`sine: ${message}\n\n${USAGE}`);
  process.exit(2);
};

let parsed;
try {
  parsed = parseArgs({
    allowPositionals: true,
    options: {
      root: { type: "string" },
      list: { type: "boolean" },
      json: { type: "boolean" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
    },
  });
} catch (error) {
  fail(error.message);
}
const { values, positionals } = parsed;
const [command, ...rest] = positionals;

if (values.version) {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  console.log(pkg.version);
  process.exit(0);
}
if (values.help || command === undefined || command === "help") {
  console.log(USAGE);
  process.exit(0);
}
if (rest.length) fail(`unexpected argument \`${rest[0]}\``);
if (values.list && command !== "lint") fail("`--list` is a `lint` option");

const root = path.resolve(values.root ?? process.cwd());
const print = (result, format) =>
  console.log(values.json ? JSON.stringify(result, null, 2) : format(result));

try {
  const { loadConfig } = await import("../cli/config.mjs");
  const { config } = await loadConfig(root);

  if (command === "lint") {
    const { formatLint, lint } = await import("../cli/lint.mjs");
    const result = await lint({ root, config: config.lint });
    if (values.json) {
      const { rootedTags, paintingClasses, allowlists, ...summary } = result;
      print(values.list ? result : summary, formatLint);
    } else {
      console.log(formatLint(result, { list: values.list }));
    }
    process.exitCode = result.findings.length ? 1 : 0;
  } else if (command === "doctor") {
    const { doctor, formatDoctor } = await import("../cli/doctor.mjs");
    const result = await doctor({ root, accept: config.doctor?.accept });
    print(result, formatDoctor);
    process.exitCode = result.checks.some((check) => check.status === "fail") ? 1 : 0;
  } else {
    fail(`unknown command \`${command}\``);
  }
} catch (error) {
  if (error?.name === "DoctorError" || error?.constructor?.name === "DoctorError") {
    console.error(`sine doctor: ${error.message}`);
  } else {
    console.error(error);
  }
  process.exit(2);
}
