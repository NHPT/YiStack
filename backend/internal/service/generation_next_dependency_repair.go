package service

import (
	"encoding/json"
	"strings"
)

const (
	unavailableNextVersion = "13.5.0"
	verifiedNextVersion    = "13.5.6"
)

const verifiedNextPackageJSON = `{
  "name": "generated-next-app",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev -H 0.0.0.0 -p $PORT",
    "build": "next build",
    "start": "next start -H 0.0.0.0 -p $PORT"
  },
  "dependencies": {
    "next": "13.5.6",
    "react": "18.2.0",
    "react-dom": "18.2.0"
  },
  "devDependencies": {
    "typescript": "5.4.5"
  }
}
`

func isUnavailableNextPackageVersion(detail string) bool {
	normalized := strings.ToLower(detail)
	return strings.Contains(normalized, "npm error 404") &&
		(strings.Contains(normalized, "next-"+unavailableNextVersion+".tgz") ||
			strings.Contains(normalized, "next@"+unavailableNextVersion))
}

func normalizeUnavailableNextPackageVersion(filePath, content string) (string, bool) {
	if filePath != "package.json" {
		return "", false
	}

	var manifest map[string]any
	if err := json.Unmarshal([]byte(content), &manifest); err != nil {
		return "", false
	}
	dependencies, ok := manifest["dependencies"].(map[string]any)
	if !ok {
		return "", false
	}
	version, ok := dependencies["next"].(string)
	if !ok || strings.TrimSpace(version) != unavailableNextVersion {
		return "", false
	}
	dependencies["next"] = verifiedNextVersion

	normalized, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return "", false
	}
	result := string(normalized) + "\n"
	return result, result != content
}
