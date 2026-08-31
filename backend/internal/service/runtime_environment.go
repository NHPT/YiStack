package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"sort"
	"strings"
	"time"
	"unicode"

	"yistack/internal/model"
	"yistack/pkg/container"
)

type runtimeLanguageSpec struct {
	Name    string `json:"name"`
	Version string `json:"version,omitempty"`
}

type runtimeServiceSpec struct {
	Type  string            `json:"type"`
	Image string            `json:"image,omitempty"`
	Env   map[string]string `json:"env,omitempty"`
}

type runtimeEnvironmentSpec struct {
	BaseImage string                `json:"baseImage"`
	Profile   string                `json:"profile"`
	Strategy  string                `json:"strategy"`
	Languages []runtimeLanguageSpec `json:"languages"`
	Services  []runtimeServiceSpec  `json:"services"`
}

type runtimeEnvironmentState struct {
	BaseImage   string                `json:"baseImage"`
	Strategy    string                `json:"strategy"`
	SpecHash    string                `json:"specHash"`
	InstalledAt string                `json:"installedAt"`
	Languages   []runtimeLanguageSpec `json:"languages"`
	Services    []runtimeServiceSpec  `json:"services"`
}

func projectRuntimeEnvironmentSpec(project *model.Project, baseImage, strategy string) runtimeEnvironmentSpec {
	profile := canonicalRuntimeProfile(projectRuntimeProfile(project))
	stack := projectTechStackMap(project)
	labels := techStackDisplayLabels(stack)
	spec := runtimeEnvironmentSpec{
		BaseImage: strings.TrimSpace(baseImage),
		Profile:   profile,
		Strategy:  strings.TrimSpace(strategy),
		Languages: inferRuntimeLanguages(profile, stack),
		Services:  nil,
	}
	if spec.BaseImage == "" {
		spec.BaseImage = defaultRuntimeImage
	}
	if spec.Strategy == "" {
		spec.Strategy = runtimeStrategyPrebuilt
	}
	log.Printf("runtime spec debug: project=%s profile=%s base_image=%s strategy=%s labels=%q languages=%v",
		strings.TrimSpace(project.ProjectID),
		spec.Profile,
		spec.BaseImage,
		spec.Strategy,
		labels,
		spec.Languages,
	)
	return spec
}

func projectTechStackMap(project *model.Project) map[string]interface{} {
	if project == nil {
		return nil
	}
	if stack := parseTechStackMap(project.TechStack); stack != nil {
		return stack
	}
	if strings.TrimSpace(project.PlanData) != "" {
		var plan struct {
			TechStack json.RawMessage `json:"tech_stack"`
		}
		if err := json.Unmarshal([]byte(project.PlanData), &plan); err == nil {
			return parseTechStackMap(string(plan.TechStack))
		}
	}
	return nil
}

func parseTechStackMap(raw string) map[string]interface{} {
	raw = strings.TrimSpace(raw)
	if raw == "" || raw == "null" {
		return nil
	}
	var stack map[string]interface{}
	if err := json.Unmarshal([]byte(raw), &stack); err != nil {
		return nil
	}
	return stack
}

func inferRuntimeLanguages(profile string, stack map[string]interface{}) []runtimeLanguageSpec {
	languages := make(map[string]string)
	lowerProfile := strings.ToLower(profile)
	isStaticProfile := lowerProfile == "static-html" || lowerProfile == "static"
	add := func(name, version string) {
		name = normalizeRuntimeName(name)
		version = strings.TrimSpace(version)
		if name == "" {
			return
		}
		if existing := languages[name]; existing != "" {
			return
		}
		languages[name] = version
	}

	if runtime, ok := stack["runtime"].(map[string]interface{}); ok {
		if items, ok := runtime["languages"].([]interface{}); ok {
			for _, item := range items {
				if text := asString(item); text != "" {
					if shouldUseRuntimeLanguageForProfile(lowerProfile, text) == false {
						continue
					}
					add(text, "")
					continue
				}
				if obj, ok := item.(map[string]interface{}); ok {
					name := asString(obj["name"])
					if shouldUseRuntimeLanguageForProfile(lowerProfile, name) == false {
						continue
					}
					add(name, asString(obj["version"]))
				}
			}
		}
	}

	switch {
	case strings.HasPrefix(lowerProfile, "node-"):
		add("node", "20")
	case strings.HasPrefix(lowerProfile, "python-"):
		add("python", "3.11")
	case strings.HasPrefix(lowerProfile, "go-"):
		add("go", "")
	case strings.Contains(lowerProfile, "java"):
		add("java", "17")
	case strings.Contains(lowerProfile, "php") || strings.Contains(lowerProfile, "laravel"):
		add("php", "8.2")
	}

	labelTokens := techStackLabelTokens(stack)
	if hasAnyLabelToken(labelTokens, "react", "next", "vue", "node", "typescript") {
		add("node", "20")
	}
	if isStaticProfile {
		return materializeRuntimeLanguages(languages)
	}
	if hasAnyLabelToken(labelTokens, "python", "django", "fastapi", "flask") {
		add("python", "3.11")
	}
	if hasAnyLabelToken(labelTokens, "go", "gin", "fiber") {
		add("go", "")
	}
	if hasAnyLabelToken(labelTokens, "java", "spring") {
		add("java", "17")
	}
	if hasAnyLabelToken(labelTokens, "php", "laravel") {
		add("php", "8.2")
	}

	return materializeRuntimeLanguages(languages)
}

func shouldUseRuntimeLanguageForProfile(profile string, languageName string) bool {
	languageName = normalizeRuntimeName(languageName)
	switch profile {
	case "static-html", "static":
		return languageName == "node"
	default:
		return true
	}
}

func materializeRuntimeLanguages(languages map[string]string) []runtimeLanguageSpec {
	result := make([]runtimeLanguageSpec, 0, len(languages))
	for name, version := range languages {
		result = append(result, runtimeLanguageSpec{Name: name, Version: version})
	}
	sort.Slice(result, func(i, j int) bool { return result[i].Name < result[j].Name })
	return result
}

func techStackLabelTokens(stack map[string]interface{}) map[string]struct{} {
	tokens := make(map[string]struct{})
	for _, label := range techStackDisplayLabels(stack) {
		for _, token := range strings.FieldsFunc(strings.ToLower(label), func(r rune) bool {
			return !unicode.IsLetter(r) && !unicode.IsDigit(r)
		}) {
			token = strings.TrimSpace(token)
			if token == "" {
				continue
			}
			tokens[token] = struct{}{}
		}
	}
	return tokens
}

func hasAnyLabelToken(tokens map[string]struct{}, values ...string) bool {
	for _, value := range values {
		if _, ok := tokens[strings.ToLower(strings.TrimSpace(value))]; ok {
			return true
		}
	}
	return false
}

func inferRuntimeServices(stack map[string]interface{}) []runtimeServiceSpec {
	_ = stack
	return nil
}

func normalizeRuntimeName(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	value = strings.ReplaceAll(value, ".", "")
	value = strings.ReplaceAll(value, " ", "")
	switch value {
	case "nodejs", "node":
		return "node"
	case "python", "python3":
		return "python"
	case "golang", "go":
		return "go"
	case "java", "jdk":
		return "java"
	case "mysql", "mariadb":
		return "mysql"
	case "postgres", "postgresql":
		return "postgres"
	case "redis":
		return "redis"
	default:
		return value
	}
}

func prepareRuntimeEnvironment(ctx context.Context, containerMgr *container.Manager, project *model.Project, spec runtimeEnvironmentSpec, aptMirrors []string) error {
	if project != nil {
		if lock := getProjectRuntimePreparationLock(project.ProjectID); lock != nil {
			lock.Lock()
			defer lock.Unlock()
		}
	}
	if err := verifyRuntimeEnvironment(ctx, containerMgr, project, spec); err == nil {
		_ = writeRuntimeEnvironmentState(project.DirectoryPath, spec)
		return nil
	} else if spec.Strategy == runtimeStrategyPrebuilt {
		return fmt.Errorf("prebuilt runtime image %s failed verification for profile %s: %w", spec.BaseImage, spec.Profile, err)
	}
	if len(spec.Languages) == 0 {
		_ = writeRuntimeEnvironmentState(project.DirectoryPath, spec)
		return nil
	}

	candidates := aptMirrors
	if len(candidates) == 0 {
		candidates = []string{""}
	}

	var failureDetails []string
	for _, mirror := range candidates {
		sourceLabel := "default"
		if strings.TrimSpace(mirror) != "" {
			sourceLabel = strings.TrimSpace(mirror)
		}
		installCommand := runtimeInstallCommand(spec, mirror)
		result, err := containerMgr.ExecuteInContainer(ctx, &container.RunOptions{
			ProjectID: project.ProjectID,
			Command:   installCommand,
			WorkDir:   "/workspace",
			Timeout:   900,
		})
		if err == nil && result.ExitCode == 0 {
			if verifyErr := verifyRuntimeEnvironment(ctx, containerMgr, project, spec); verifyErr == nil {
				_ = writeRuntimeEnvironmentState(project.DirectoryPath, spec)
				return nil
			} else {
				failureDetails = append(failureDetails, fmt.Sprintf("[%s] install succeeded but verify failed: %v", sourceLabel, verifyErr))
				continue
			}
		}

		if err != nil {
			if runtimeInstallTimedOut(err) {
				recoveryCtx, cancel := context.WithTimeout(safeContext(ctx), 180*time.Second)
				recovered := waitForAptToSettleAndVerify(recoveryCtx, containerMgr, project, spec)
				cancel()
				if recovered == nil {
					_ = writeRuntimeEnvironmentState(project.DirectoryPath, spec)
					return nil
				}
				failureDetails = append(failureDetails, fmt.Sprintf("[%s] %v; recovery check failed: %v", sourceLabel, err, recovered))
				continue
			}
			failureDetails = append(failureDetails, fmt.Sprintf("[%s] %v", sourceLabel, err))
			continue
		}

		detail := strings.TrimSpace(result.Stderr)
		if detail == "" {
			detail = strings.TrimSpace(result.Stdout)
		}
		if detail == "" {
			detail = "install command exited without stderr output"
		}
		failureDetails = append(failureDetails, fmt.Sprintf("[%s] %s", sourceLabel, detail))
	}

	if len(failureDetails) == 0 {
		return fmt.Errorf("install runtime environment failed: no apt mirror candidate available")
	}
	return fmt.Errorf("install runtime environment failed after trying mirrors: %s", strings.Join(failureDetails, " | "))
}

func verifyRuntimeEnvironment(ctx context.Context, containerMgr *container.Manager, project *model.Project, spec runtimeEnvironmentSpec) error {
	if containerMgr == nil {
		return fmt.Errorf("container manager not available")
	}
	if project == nil || strings.TrimSpace(project.ProjectID) == "" {
		return fmt.Errorf("project is required")
	}

	verifyCommand := runtimeVerifyCommand(spec.Languages)
	if verifyCommand == "" {
		return nil
	}
	log.Printf("runtime verify debug: project=%s profile=%s languages=%v command=%q",
		strings.TrimSpace(project.ProjectID),
		spec.Profile,
		spec.Languages,
		verifyCommand,
	)

	result, err := containerMgr.ExecuteInContainer(ctx, &container.RunOptions{
		ProjectID: project.ProjectID,
		Command:   verifyCommand,
		WorkDir:   "/workspace",
		Timeout:   120,
	})
	if err != nil {
		return err
	}
	if result.ExitCode != 0 {
		detail := strings.TrimSpace(result.Stderr)
		if detail == "" {
			detail = strings.TrimSpace(result.Stdout)
		}
		if detail == "" {
			detail = fmt.Sprintf("runtime verify failed with exit code %d", result.ExitCode)
		}
		return fmt.Errorf(detail)
	}
	return nil
}

func runtimeVerifyCommand(languages []runtimeLanguageSpec) string {
	checks := []string{
		runtimeVerifyBinaryCommand("git", "git"),
		runtimeVerifyBinaryCommand("curl", "curl"),
		runtimeVerifyBinaryCommand("bash", "bash"),
	}
	for _, language := range languages {
		switch language.Name {
		case "node":
			checks = append(checks,
				runtimeVerifyBinaryCommand("node", "node"),
				runtimeVerifyBinaryCommand("pnpm", "pnpm"),
			)
		case "python":
			checks = append(checks,
				runtimeVerifyPythonVirtualEnvironmentCommand(),
			)
		case "go":
			checks = append(checks, runtimeVerifyBinaryCommand("go", "go"))
		case "java":
			checks = append(checks, runtimeVerifyBinaryCommand("java", "java"))
		case "php":
			checks = append(checks,
				runtimeVerifyBinaryCommand("php", "php"),
				runtimeVerifyBinaryCommand("composer", "composer"),
			)
		}
	}
	return strings.Join(checks, "; ")
}

func runtimeVerifyBinaryCommand(binary, label string) string {
	return fmt.Sprintf("if ! command -v %s >/dev/null 2>&1; then echo 'missing runtime dependency: %s' >&2; exit 1; fi", binary, label)
}

func runtimeInstallCommand(spec runtimeEnvironmentSpec, aptMirror string) string {
	needs := map[string]bool{}
	for _, language := range spec.Languages {
		needs[language.Name] = true
	}

	lines := []string{
		"set -e",
		"export DEBIAN_FRONTEND=noninteractive",
		"APT_ARGS='-o Acquire::Retries=2 -o Acquire::http::Timeout=20 -o Acquire::https::Timeout=20 -o Acquire::http::Pipeline-Depth=0'",
	}
	if mirrorCommand := runtimeAptMirrorSetupCommand(aptMirror); mirrorCommand != "" {
		lines = append(lines, mirrorCommand)
	}
	aptUpdateCommand := runtimeAptCommand("apt-get $APT_ARGS update")
	baseInstallCommand := runtimeAptCommand(
		"apt-get $APT_ARGS install -y --no-install-recommends ca-certificates bash git curl wget unzip build-essential make pkg-config",
	)
	requiresAptRuntime := needs["python"] || needs["java"] || needs["php"] ||
		(needs["node"] && runtimeBaseHasNode(spec.BaseImage) == false)
	if requiresAptRuntime {
		lines = append(lines, aptUpdateCommand, baseInstallCommand)
	} else {
		lines = append(lines,
			fmt.Sprintf("if ! ( %s ); then", runtimeBasePrerequisiteCheckCommand()),
			"  "+aptUpdateCommand,
			"  "+baseInstallCommand,
			"fi",
		)
	}
	if needs["node"] {
		if runtimeBaseHasNode(spec.BaseImage) {
			lines = append(lines,
				"command -v node >/dev/null 2>&1 || { echo 'node base image is expected to include node, but node was not found' >&2; exit 1; }",
				"if command -v corepack >/dev/null 2>&1; then corepack enable || true; fi",
				"if ! command -v pnpm >/dev/null 2>&1; then npm install -g pnpm; fi",
			)
		} else {
			lines = append(lines,
				"if ! command -v node >/dev/null 2>&1 || ! node -v | grep -q '^v20\\.'; then curl -fsSL --max-time 30 https://deb.nodesource.com/setup_20.x | bash - && "+runtimeAptCommand("apt-get $APT_ARGS install -y --no-install-recommends nodejs")+"; fi",
				"if command -v corepack >/dev/null 2>&1; then corepack enable || true; fi",
				"if ! command -v pnpm >/dev/null 2>&1; then npm install -g pnpm; fi",
			)
		}
	}
	if needs["python"] {
		lines = append(lines, runtimeAptCommand("apt-get $APT_ARGS install -y --no-install-recommends python3.11 python3.11-venv python3.11-dev"))
	}
	if needs["go"] {
		lines = append(lines,
			"GO_VERSION=1.22.12",
			"case \"$(dpkg --print-architecture)\" in amd64) GO_ARCH=amd64; GO_SHA256=4fa4f869b0f7fc6bb1eb2660e74657fbf04cdd290b5aef905585c86051b34d43 ;; arm64) GO_ARCH=arm64; GO_SHA256=fd017e647ec28525e86ae8203236e0653242722a7436929b1f775744e26278e7 ;; *) echo 'unsupported architecture for Go runtime' >&2; exit 1 ;; esac",
			"GO_TARBALL=/tmp/go${GO_VERSION}.linux-${GO_ARCH}.tar.gz",
			"if ! curl -fsSL --continue-at - --connect-timeout 10 --max-time 180 \"https://golang.google.cn/dl/go${GO_VERSION}.linux-${GO_ARCH}.tar.gz\" -o \"$GO_TARBALL\"; then",
			"  if ! echo \"${GO_SHA256}  ${GO_TARBALL}\" | sha256sum -c -; then",
			"    exit 1",
			"  fi",
			"fi",
			"echo \"${GO_SHA256}  ${GO_TARBALL}\" | sha256sum -c - || { rm -f \"$GO_TARBALL\"; exit 1; }",
			"rm -rf /usr/local/go",
			"tar -C /usr/local -xzf \"$GO_TARBALL\"",
			"rm -f \"$GO_TARBALL\"",
			"ln -sf /usr/local/go/bin/go /usr/local/bin/go",
			"ln -sf /usr/local/go/bin/gofmt /usr/local/bin/gofmt",
			"go version",
			"go env -w GOPROXY=https://goproxy.cn,direct",
			"go env -w 'GOSUMDB=sum.golang.org https://goproxy.cn/sumdb/sum.golang.org'",
		)
	}
	if needs["java"] {
		lines = append(lines, runtimeAptCommand("apt-get $APT_ARGS install -y --no-install-recommends openjdk-17-jdk maven"))
	}
	if needs["php"] {
		lines = append(lines, runtimeAptCommand("apt-get $APT_ARGS install -y --no-install-recommends php-cli composer php-curl php-mbstring php-xml php-zip"))
	}
	lines = append(lines, "rm -rf /var/lib/apt/lists/*")
	return strings.Join(lines, "\n")
}

func runtimeAptCommand(command string) string {
	return "timeout --signal=TERM --kill-after=30s 300s " + command
}

func runtimeBasePrerequisiteCheckCommand() string {
	checks := []string{
		"command -v timeout >/dev/null 2>&1",
		"command -v bash >/dev/null 2>&1",
		"command -v git >/dev/null 2>&1",
		"command -v curl >/dev/null 2>&1",
		"command -v wget >/dev/null 2>&1",
		"command -v unzip >/dev/null 2>&1",
		"command -v make >/dev/null 2>&1",
		"command -v gcc >/dev/null 2>&1",
		"command -v g++ >/dev/null 2>&1",
		"command -v tar >/dev/null 2>&1",
		"command -v sha256sum >/dev/null 2>&1",
		"test -s /etc/ssl/certs/ca-certificates.crt",
	}
	return strings.Join(checks, " && ")
}

func runtimeAptMirrorSetupCommand(aptMirror string) string {
	aptMirror = strings.TrimRight(strings.TrimSpace(aptMirror), "/")
	if aptMirror == "" {
		return "rm -f /etc/apt/sources.list.d/00-yistack.sources"
	}

	mirrorValue := shellSingleQuote(aptMirror)
	lines := []string{
		fmt.Sprintf("APT_MIRROR=%s", mirrorValue),
		"mkdir -p /etc/apt/sources.list.d",
		"cat >/etc/apt/sources.list.d/00-yistack.sources <<EOF",
		"Types: deb",
		"URIs: ${APT_MIRROR}/debian",
		"Suites: bookworm bookworm-updates bookworm-backports",
		"Components: main contrib non-free non-free-firmware",
		"Signed-By: /usr/share/keyrings/debian-archive-keyring.gpg",
		"",
		"Types: deb",
		"URIs: ${APT_MIRROR}/debian-security",
		"Suites: bookworm-security",
		"Components: main contrib non-free non-free-firmware",
		"Signed-By: /usr/share/keyrings/debian-archive-keyring.gpg",
		"EOF",
	}
	return strings.Join(lines, "\n")
}

func runtimeBaseHasNode(baseImage string) bool {
	baseImage = strings.ToLower(strings.TrimSpace(baseImage))
	return strings.Contains(baseImage, "/node:") ||
		strings.HasPrefix(baseImage, "node:") ||
		strings.Contains(baseImage, "/devbox:") ||
		strings.HasPrefix(baseImage, "devbox:")
}

func runtimeInstallTimedOut(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, context.DeadlineExceeded) || errors.Is(err, context.Canceled) {
		return true
	}
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "context deadline exceeded") ||
		strings.Contains(message, "client.timeout") ||
		strings.Contains(message, "context cancellation while reading body")
}

func waitForAptToSettleAndVerify(ctx context.Context, containerMgr *container.Manager, project *model.Project, spec runtimeEnvironmentSpec) error {
	if err := waitForAptLocksToClear(ctx, containerMgr, project); err != nil {
		return err
	}
	return verifyRuntimeEnvironment(ctx, containerMgr, project, spec)
}

func waitForAptLocksToClear(ctx context.Context, containerMgr *container.Manager, project *model.Project) error {
	waitCommand := strings.Join([]string{
		"deadline=$(( $(date +%s) + 150 ))",
		"while pgrep -x apt-get >/dev/null 2>&1 || pgrep -x dpkg >/dev/null 2>&1 || pgrep -x unattended-upgr >/dev/null 2>&1; do",
		"  if [ \"$(date +%s)\" -ge \"$deadline\" ]; then",
		"    echo 'timed out waiting for apt/dpkg to finish' >&2",
		"    exit 1",
		"  fi",
		"  sleep 2",
		"done",
		"for lock in /var/lib/apt/lists/lock /var/lib/dpkg/lock /var/lib/dpkg/lock-frontend /var/cache/apt/archives/lock; do",
		"  if [ -e \"$lock\" ]; then",
		"    while fuser \"$lock\" >/dev/null 2>&1; do",
		"      if [ \"$(date +%s)\" -ge \"$deadline\" ]; then",
		"        echo \"timed out waiting for lock $lock\" >&2",
		"        exit 1",
		"      fi",
		"      sleep 2",
		"    done",
		"  fi",
		"done",
	}, "\n")

	result, err := containerMgr.ExecuteInContainer(ctx, &container.RunOptions{
		ProjectID: project.ProjectID,
		Command:   waitCommand,
		WorkDir:   "/workspace",
		Timeout:   180,
	})
	if err != nil {
		return err
	}
	if result.ExitCode != 0 {
		detail := strings.TrimSpace(result.Stderr)
		if detail == "" {
			detail = strings.TrimSpace(result.Stdout)
		}
		if detail == "" {
			detail = "waiting for apt locks failed"
		}
		return fmt.Errorf(detail)
	}
	return nil
}

func writeRuntimeEnvironmentState(projectDir string, spec runtimeEnvironmentSpec) error {
	if strings.TrimSpace(projectDir) == "" {
		return nil
	}
	safeProjectDir, err := secureHostPathWithinProjectRoot(currentProjectRootDir(), projectDir)
	if err != nil {
		return err
	}
	state := runtimeEnvironmentState{
		BaseImage:   spec.BaseImage,
		Strategy:    spec.Strategy,
		SpecHash:    runtimeSpecHash(spec),
		InstalledAt: time.Now().UTC().Format(time.RFC3339),
		Languages:   spec.Languages,
		Services:    spec.Services,
	}
	data, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return err
	}
	dir := runtimeStateDir(safeProjectDir)
	if dir == "" {
		return fmt.Errorf("unsafe runtime state directory")
	}
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	return writeRuntimeStateFileAtomically(runtimeEnvironmentStatePath(safeProjectDir), data, 0644)
}

func runtimeApplicationPort(spec runtimeEnvironmentSpec) int {
	switch spec.Profile {
	case "node-react", "node-vue":
		return 5173
	case "python-fastapi", "python-django", "python-flask":
		return 8000
	case "go-gin", "go-fiber", "java":
		return 8080
	case "php-laravel":
		return 8000
	default:
		return 3000
	}
}

func runtimeMainContainerEnv(projectID string, spec runtimeEnvironmentSpec) []string {
	return []string{}
}

func runtimeSpecHash(spec runtimeEnvironmentSpec) string {
	data, _ := json.Marshal(spec)
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}
