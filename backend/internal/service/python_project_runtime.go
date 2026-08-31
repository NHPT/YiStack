package service

const (
	projectPythonRuntimeExecutable        = "python3.11"
	projectPythonVirtualEnvironmentPath   = ".yistack/runtime/python-venv"
	projectPythonPackageIndexURL          = "https://mirrors.aliyun.com/pypi/simple"
	projectPythonPackageInstallTimeout    = "30"
	projectPythonPackageInstallRetryCount = "3"
)

func projectPythonExecutablePath() string {
	return projectPythonVirtualEnvironmentPath + "/bin/python"
}

func projectPythonVirtualEnvironmentCreationArgs() []string {
	return []string{
		projectPythonRuntimeExecutable,
		"-m",
		"venv",
		projectPythonVirtualEnvironmentPath,
	}
}

func projectPythonPackageInstallArgs(target ...string) []string {
	args := []string{
		projectPythonExecutablePath(),
		"-m",
		"pip",
		"install",
		"--disable-pip-version-check",
		"--no-input",
		"--index-url",
		projectPythonPackageIndexURL,
		"--timeout",
		projectPythonPackageInstallTimeout,
		"--retries",
		projectPythonPackageInstallRetryCount,
	}
	return append(args, target...)
}

func runtimeVerifyPythonVirtualEnvironmentCommand() string {
	return "if ! command -v python3.11 >/dev/null 2>&1; then echo 'missing runtime dependency: python3.11' >&2; exit 1; fi; " +
		"if ! python3.11 -c 'import sys; raise SystemExit(0 if sys.version_info[:2] == (3, 11) else 1)' >/dev/null 2>&1; then echo 'runtime dependency version mismatch: python3.11' >&2; exit 1; fi; " +
		"if ! python3.11 -c 'import ensurepip' >/dev/null 2>&1; then echo 'missing runtime dependency: python3.11-venv' >&2; exit 1; fi"
}
