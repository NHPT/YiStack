package service

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

const projectValidationMaxDiagnostics = 50

var (
	projectDiagnosticColonPattern = regexp.MustCompile(`^\s*(.+?):([0-9]+):(?:([0-9]+):)?\s*(.+?)\s*$`)
	projectDiagnosticParenPattern = regexp.MustCompile(`^\s*(.+?)\(([0-9]+),\s*([0-9]+)\):\s*(.+?)\s*$`)
)

type ProjectValidationDiagnostic struct {
	Check    string `json:"check"`
	Severity string `json:"severity"`
	Path     string `json:"path,omitempty"`
	Line     int    `json:"line,omitempty"`
	Column   int    `json:"column,omitempty"`
	Message  string `json:"message"`
}

func finalizeProjectValidationFailure(result *ProjectValidationResult) {
	if result == nil {
		return
	}
	result.Diagnostics = collectProjectValidationDiagnostics(result.Checks)
	result.FailureFingerprint = projectValidationFailureFingerprint(result)
}

func collectProjectValidationDiagnostics(checks []ProjectValidationCheck) []ProjectValidationDiagnostic {
	diagnostics := make([]ProjectValidationDiagnostic, 0)
	seen := map[string]struct{}{}
	for _, check := range checks {
		if check.Status != ProjectValidationStatusFailed {
			continue
		}
		before := len(diagnostics)
		for _, line := range strings.Split(strings.TrimSpace(check.Output), "\n") {
			diagnostic, ok := parseProjectValidationDiagnosticLine(check.Kind, line)
			if !ok {
				continue
			}
			key := fmt.Sprintf("%s\x00%s\x00%d\x00%d\x00%s", diagnostic.Check, diagnostic.Path, diagnostic.Line, diagnostic.Column, diagnostic.Message)
			if _, exists := seen[key]; exists {
				continue
			}
			seen[key] = struct{}{}
			diagnostics = append(diagnostics, diagnostic)
			if len(diagnostics) >= projectValidationMaxDiagnostics {
				return diagnostics
			}
		}
		if len(diagnostics) == before && strings.TrimSpace(check.Message) != "" {
			diagnostics = append(diagnostics, ProjectValidationDiagnostic{
				Check: check.Kind, Severity: diagnosticSeverity(check.Message), Message: strings.TrimSpace(check.Message),
			})
		}
	}
	return diagnostics
}

func parseProjectValidationDiagnosticLine(check, line string) (ProjectValidationDiagnostic, bool) {
	line = strings.TrimSpace(line)
	if line == "" {
		return ProjectValidationDiagnostic{}, false
	}
	matches := projectDiagnosticParenPattern.FindStringSubmatch(line)
	if len(matches) == 0 {
		matches = projectDiagnosticColonPattern.FindStringSubmatch(line)
	}
	if len(matches) == 0 {
		return ProjectValidationDiagnostic{}, false
	}
	filePath := strings.TrimPrefix(strings.TrimSpace(matches[1]), "/workspace/")
	filePath = strings.TrimPrefix(filePath, "./")
	normalizedPath, err := normalizeProjectRelativePath(filePath)
	if err != nil || isProtectedGenerationPath(normalizedPath) {
		return ProjectValidationDiagnostic{}, false
	}
	lineNumber, _ := strconv.Atoi(matches[2])
	columnNumber, _ := strconv.Atoi(matches[3])
	message := strings.TrimSpace(matches[4])
	if message == "" {
		return ProjectValidationDiagnostic{}, false
	}
	return ProjectValidationDiagnostic{
		Check: strings.TrimSpace(check), Severity: diagnosticSeverity(message),
		Path: normalizedPath, Line: lineNumber, Column: columnNumber, Message: message,
	}, true
}

func diagnosticSeverity(message string) string {
	normalized := strings.ToLower(message)
	switch {
	case strings.Contains(normalized, "warning"), strings.Contains(normalized, "warn:"):
		return "warning"
	case strings.Contains(normalized, "info"):
		return "info"
	default:
		return "error"
	}
}

func projectValidationFailureFingerprint(result *ProjectValidationResult) string {
	var builder strings.Builder
	builder.WriteString(strings.TrimSpace(result.Stack))
	for _, diagnostic := range result.Diagnostics {
		builder.WriteString(fmt.Sprintf("\n%s|%s|%d|%d|%s", diagnostic.Check, diagnostic.Path, diagnostic.Line, diagnostic.Column, normalizeDiagnosticFingerprintText(diagnostic.Message)))
	}
	if len(result.Diagnostics) == 0 {
		for _, check := range result.Checks {
			if check.Status == ProjectValidationStatusFailed {
				builder.WriteString("\n" + check.Kind + "|" + strings.Join(check.Command, " ") + "|" + normalizeDiagnosticFingerprintText(check.Message))
			}
		}
	}
	sum := sha256.Sum256([]byte(builder.String()))
	return hex.EncodeToString(sum[:])
}

func normalizeDiagnosticFingerprintText(value string) string {
	return strings.Join(strings.Fields(strings.ToLower(strings.TrimSpace(value))), " ")
}
