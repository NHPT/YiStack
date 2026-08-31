package service

const nodeRuntimeSyntaxValidationScript = `
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = process.cwd();
const ignored = new Set([
  ".git",
  ".next",
  ".yistack",
  "build",
  "coverage",
  "dist",
  "node_modules",
]);
const extensions = new Set([".js", ".cjs", ".mjs"]);
const failures = [];

function visit(directory) {
  for (const entry of fs.readdirSync(directory, {
    withFileTypes: true,
  })) {
    if (ignored.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      visit(absolute);
      continue;
    }
    if (!entry.isFile() ||
        !extensions.has(path.extname(entry.name))) {
      continue;
    }
    const result = spawnSync(
      process.execPath,
      ["--check", absolute],
      { encoding: "utf8" },
    );
    if (result.status !== 0) {
      failures.push(
        [
          path.relative(root, absolute),
          result.stderr || result.stdout ||
            "Node syntax check failed",
        ].join("\n"),
      );
    }
  }
}

visit(root);
if (failures.length > 0) {
  process.stderr.write(failures.join("\n"));
  process.exit(1);
}
`

func buildNodeRuntimeSyntaxCheck() projectValidationPlanCheck {
	return projectValidationPlanCheck{
		id:      "node-syntax",
		kind:    "browser-runtime",
		title:   "验证 Node.js 运行时语法",
		args:    []string{"node", "-e", nodeRuntimeSyntaxValidationScript},
		timeout: 120,
		status:  ProjectValidationStatusPassed,
	}
}
