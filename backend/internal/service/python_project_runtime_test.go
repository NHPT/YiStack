package service

import (
	"strings"
	"testing"
)

func TestProjectPythonCommandsEnforceRuntimeAndPackageMirror(t *testing.T) {
	environmentCommand := strings.Join(
		projectPythonVirtualEnvironmentCreationArgs(),
		" ",
	)
	if environmentCommand !=
		"python3.11 -m venv .yistack/runtime/python-venv" {
		t.Fatalf(
			"unexpected Python virtual environment command: %s",
			environmentCommand,
		)
	}

	installCommand := strings.Join(
		projectPythonPackageInstallArgs("-r", "requirements.txt"),
		" ",
	)
	expectedInstallCommand := strings.Join([]string{
		".yistack/runtime/python-venv/bin/python",
		"-m pip install",
		"--disable-pip-version-check",
		"--no-input",
		"--index-url https://mirrors.aliyun.com/pypi/simple",
		"--timeout 30",
		"--retries 3",
		"-r requirements.txt",
	}, " ")
	if installCommand != expectedInstallCommand {
		t.Fatalf(
			"unexpected Python package install command:\nwant: %s\ngot:  %s",
			expectedInstallCommand,
			installCommand,
		)
	}
}
