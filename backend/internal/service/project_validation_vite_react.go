package service

const viteReactJSXRuntimeValidationScript = `
const fs = require("node:fs");
const path = require("node:path");
const root = process.env.YISTACK_VALIDATION_ROOT || "/workspace";
const configNames = [
  "vite.config.js",
  "vite.config.mjs",
  "vite.config.cjs",
  "vite.config.ts",
  "vite.config.mts",
  "vite.config.cts",
];
const config = configNames
  .map((name) => path.join(root, name))
  .filter((file) => fs.existsSync(file))
  .map((file) => fs.readFileSync(file, "utf8"))
  .join("\n");

let transformConfigured = /\bjsx\s*:\s*["']automatic["']/.test(config);
const pluginImports = /import\s+([A-Za-z_$][\w$]*)\s+from\s+["']@vitejs\/plugin-react(?:-swc)?["']/g;
for (const match of config.matchAll(pluginImports)) {
  const binding = match[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp("\\b" + binding + "\\s*\\(").test(config) && /\bplugins\s*:/.test(config)) {
    transformConfigured = true;
  }
}

const ignored = new Set([".git", ".pnpm-store", ".yistack", "dist", "node_modules"]);
const browserExtensions = new Set([".js", ".jsx", ".ts", ".tsx"]);
const reactFailures = [];
const environmentFailures = [];
const supabaseFailures = [];
const supabaseCredentialFailures = [];
const nestedTableRowFailures = [];
const entryMountFailures = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(file);
      continue;
    }
    const extension = path.extname(entry.name);
    if (!entry.isFile() || !browserExtensions.has(extension)) continue;
    const source = fs.readFileSync(file, "utf8");
    const relative = path.relative(root, file).split(path.sep).join("/");
    if (relative.startsWith("src/") && /\bprocess\.env\.VITE_[A-Za-z_][A-Za-z0-9_]*/.test(source)) {
      environmentFailures.push(relative);
    }
    if (relative.startsWith("src/") && /(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*createClient\s*\(/.test(source)) {
      supabaseFailures.push(relative);
    }
    if (
      relative.startsWith("src/") &&
      /import\.meta\.env\.VITE_SUPABASE_(?:URL|ANON_KEY)\s*(?:\|\||\?\?)\s*["'][^"']+["']/.test(source)
    ) {
      supabaseCredentialFailures.push(relative);
    }
    if (/<tr\b[^>]*>\s*<tr\b/i.test(source)) {
      nestedTableRowFailures.push(relative);
    }
    if (extension !== ".jsx" || transformConfigured) continue;
    if (!/<[A-Za-z]|<>/.test(source)) continue;
    const bindsReact =
      /import\s+React(?:\s*,|\s+from)/.test(source) ||
      /import\s+\*\s+as\s+React\s+from/.test(source) ||
      /(?:const|let|var)\s+React\s*=\s*require\s*\(\s*["']react["']\s*\)/.test(source);
    if (!bindsReact) reactFailures.push(relative);
  }
}
walk(root);
const indexPath = path.join(root, "index.html");
if (fs.existsSync(indexPath)) {
  const indexSource = fs.readFileSync(indexPath, "utf8");
  const entryPattern = /<script\b[^>]*\bsrc\s*=\s*["'](?:\.\/|\/)?([^"'?#]+)(?:[?#][^"']*)?["'][^>]*>/ig;
  const entries = [...indexSource.matchAll(entryPattern)]
    .map((match) => match[1])
    .filter((entry) => entry.startsWith("src/"));
  if (entries.length === 0) {
    entryMountFailures.push("index.html");
  } else {
    for (const relative of entries) {
      const file = path.join(root, relative);
      if (!fs.existsSync(file)) continue;
      const source = fs.readFileSync(file, "utf8");
      const mountsRoot =
        (source.includes("createRoot(") && source.includes(".render(")) ||
        source.includes("ReactDOM.render(");
      if (!mountsRoot) entryMountFailures.push(relative);
    }
  }
}
for (const file of reactFailures) {
  process.stderr.write(
    file + ":1:1: React is not defined at runtime; configure @vitejs/plugin-react in vite.config or import React\n",
  );
}
for (const file of environmentFailures) {
  process.stderr.write(
    file + ":1:1: process is not defined in Vite browser source; use import.meta.env for VITE_* variables\n",
  );
}
for (const file of supabaseFailures) {
  process.stderr.write(
    file + ":1:1: Supabase client is created before Vite credentials are checked; use a deterministic local fallback\n",
  );
}
for (const file of supabaseCredentialFailures) {
  process.stderr.write(
    file + ":1:1: Vite Supabase credentials use non-empty fallback literals; use empty strings and deterministic local data\n",
  );
}
for (const file of nestedTableRowFailures) {
  process.stderr.write(
    file + ":1:1: nested <tr> elements are invalid; render table cells directly inside one row\n",
  );
}
for (const file of entryMountFailures) {
  process.stderr.write(
    file + ":1:1: Vite React entry module does not mount the application root; call createRoot(...).render(...)\n",
  );
}
if (
  reactFailures.length > 0 ||
  environmentFailures.length > 0 ||
  supabaseFailures.length > 0 ||
  supabaseCredentialFailures.length > 0 ||
  nestedTableRowFailures.length > 0 ||
  entryMountFailures.length > 0
) process.exit(1);
`

func buildViteReactRuntimeCheck() projectValidationPlanCheck {
	return projectValidationPlanCheck{
		id:      "browser-runtime",
		kind:    "browser-runtime",
		title:   "验证 React 浏览器运行时",
		args:    []string{"node", "-e", viteReactJSXRuntimeValidationScript},
		timeout: 120,
		status:  ProjectValidationStatusPassed,
	}
}
