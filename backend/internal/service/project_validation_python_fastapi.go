package service

const pythonFastAPIRuntimeValidationScript = `
import ast
import pathlib
import sys

root = pathlib.Path("/workspace")
ignored = {".git", ".yistack", ".venv", "venv", "__pycache__"}
failures = []

for file in root.rglob("*.py"):
    if any(part in ignored for part in file.relative_to(root).parts):
        continue
    try:
        tree = ast.parse(file.read_text(encoding="utf-8"), filename=str(file))
    except (OSError, UnicodeError, SyntaxError):
        continue
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        function = node.func
        if not isinstance(function, ast.Attribute) or function.attr != "TemplateResponse":
            continue
        if len(node.args) < 2:
            continue
        if not isinstance(node.args[0], ast.Constant) or not isinstance(node.args[0].value, str):
            continue
        if not isinstance(node.args[1], ast.Dict):
            continue
        relative = file.relative_to(root).as_posix()
        failures.append((relative, node.lineno, node.col_offset + 1))

for file, line, column in failures:
    print(
        f"{file}:{line}:{column}: Starlette TemplateResponse positional arguments are incompatible; "
        "use TemplateResponse(request=request, name=..., context=...)",
        file=sys.stderr,
    )

if failures:
    raise SystemExit(1)
`

func buildPythonFastAPIRuntimeCheck() projectValidationPlanCheck {
	return projectValidationPlanCheck{
		id:      "browser-runtime",
		kind:    "browser-runtime",
		title:   "验证 FastAPI 浏览器运行时",
		args:    []string{projectPythonExecutablePath(), "-c", pythonFastAPIRuntimeValidationScript},
		timeout: 120,
		status:  ProjectValidationStatusPassed,
	}
}
