package service

import (
	"errors"
	"strings"
)

var generatedCommandAllowlist = map[string]struct{}{
	"npm ci":                                     {},
	"npm install":                                {},
	"npm install --legacy-peer-deps":             {},
	"pnpm install":                               {},
	"pnpm install --frozen-lockfile":             {},
	"yarn install":                               {},
	"yarn install --frozen-lockfile":             {},
	"yarn install --immutable":                   {},
	"go mod download":                            {},
	"go mod tidy":                                {},
	"python3 -m pip install .":                   {},
	"python3 -m pip install -r requirements.txt": {},
	"pip install .":                              {},
	"pip install -r requirements.txt":            {},
}

func validateGeneratedCommandPolicy(command string) error {
	command = strings.TrimSpace(command)
	if command == "" {
		return errors.New("generated command is empty")
	}
	if strings.ContainsAny(command, "\n\r;&|><`") || strings.Contains(command, "$(") {
		return errors.New("generated command contains unsupported shell control syntax")
	}
	normalized := strings.Join(strings.Fields(command), " ")
	if _, allowed := generatedCommandAllowlist[normalized]; allowed {
		return nil
	}
	return errors.New("generated command is outside the controlled dependency preparation policy")
}

func generatedCommandExecutionPlan(command string) [][]string {
	normalized := strings.Join(strings.Fields(command), " ")
	switch normalized {
	case "python3 -m pip install -r requirements.txt",
		"pip install -r requirements.txt":
		return [][]string{
			projectPythonVirtualEnvironmentCreationArgs(),
			projectPythonPackageInstallArgs("-r", "requirements.txt"),
		}
	case "python3 -m pip install .", "pip install .":
		return [][]string{
			projectPythonVirtualEnvironmentCreationArgs(),
			projectPythonPackageInstallArgs("."),
		}
	default:
		return [][]string{strings.Fields(normalized)}
	}
}
