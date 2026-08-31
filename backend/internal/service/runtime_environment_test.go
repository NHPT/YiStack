package service

import (
	"os/exec"
	"strings"
	"testing"

	"yistack/config"
	"yistack/internal/model"
)

func TestInferRuntimeLanguagesDoesNotTreatJavaScriptAsJava(t *testing.T) {
	stack := map[string]interface{}{
		"summary": []interface{}{"HTML", "Tailwind CSS", "HTML/JavaScript"},
	}

	languages := inferRuntimeLanguages("static-html", stack)

	for _, language := range languages {
		if language.Name == "java" {
			t.Fatalf("expected JavaScript label not to infer java runtime, got languages=%v", languages)
		}
	}
}

func TestInferRuntimeLanguagesIgnoresStaticHTMLBackendGeneratorLabels(t *testing.T) {
	stack := map[string]interface{}{
		"runtime": map[string]interface{}{
			"profile": "static-html",
			"languages": []interface{}{
				map[string]interface{}{"name": "go", "version": "1.22"},
			},
		},
		"summary": []interface{}{"Go", "Hugo", "Contentful", "Vercel", "Tailwind CSS", "HTML/CSS/JS", "none"},
	}

	languages := inferRuntimeLanguages("static-html", stack)

	for _, language := range languages {
		if language.Name == "go" {
			t.Fatalf("static-html profile should not require Go runtime from generator labels, got languages=%v", languages)
		}
	}
}

func TestInferRuntimeLanguagesStillDetectsExplicitJavaLabels(t *testing.T) {
	stack := map[string]interface{}{
		"summary": []interface{}{"Java", "Spring Boot"},
	}

	languages := inferRuntimeLanguages("java-spring", stack)

	foundJava := false
	for _, language := range languages {
		if language.Name == "java" {
			foundJava = true
			break
		}
	}
	if !foundJava {
		t.Fatalf("expected explicit Java labels to infer java runtime, got languages=%v", languages)
	}
}

func TestProjectRuntimeProfileFallsBackToAppType(t *testing.T) {
	cases := []struct {
		name    string
		appType string
		want    string
	}{
		{name: "web", appType: "web", want: "node-nextjs"},
		{name: "mobile", appType: "mobile", want: "node-react"},
		{name: "miniprogram", appType: "miniprogram", want: "node-react"},
		{name: "desktop", appType: "desktop", want: "node-react"},
		{name: "ai agent", appType: "ai_agent", want: "python-fastapi"},
		{name: "unknown", appType: "custom", want: "default"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := projectRuntimeProfile(&model.Project{AppType: tc.appType})
			if got != tc.want {
				t.Fatalf("expected runtime profile %q, got %q", tc.want, got)
			}
		})
	}
}

func TestSelectRuntimeImageUsesDynamicInstallForDefaultFallback(t *testing.T) {
	selected, strategy := selectRuntimeImage(
		"go-gin",
		&config.ContainerConfig{
			Images: []config.ContainerImage{
				{
					Type:  "default",
					Image: "localhost/devbox:bookworm",
					Port:  3000,
				},
			},
		},
	)
	if selected.Image != "localhost/devbox:bookworm" {
		t.Fatalf("unexpected fallback image: %#v", selected)
	}
	if strategy != runtimeStrategyDynamicInstall {
		t.Fatalf(
			"fallback strategy = %q, want %q",
			strategy,
			runtimeStrategyDynamicInstall,
		)
	}
}

func TestSelectRuntimeImageKeepsProfileSpecificImagePrebuilt(t *testing.T) {
	selected, strategy := selectRuntimeImage(
		"go-gin",
		&config.ContainerConfig{
			Images: []config.ContainerImage{
				{
					Type:  "go-gin",
					Image: "registry.example/go-devbox:1.24",
					Port:  8080,
				},
			},
		},
	)
	if selected.Image != "registry.example/go-devbox:1.24" {
		t.Fatalf("unexpected profile image: %#v", selected)
	}
	if strategy != runtimeStrategyPrebuilt {
		t.Fatalf(
			"profile strategy = %q, want %q",
			strategy,
			runtimeStrategyPrebuilt,
		)
	}
}

func TestRuntimeInstallCommandConfiguresVerifiedGoProxy(t *testing.T) {
	command := runtimeInstallCommand(runtimeEnvironmentSpec{
		BaseImage: "localhost/devbox:bookworm",
		Languages: []runtimeLanguageSpec{{Name: "go"}},
	}, "")

	for _, expected := range []string{
		"if ! ( command -v timeout",
		"timeout --signal=TERM --kill-after=30s 300s apt-get $APT_ARGS update",
		"GO_VERSION=1.22.12",
		"GO_SHA256=4fa4f869b0f7fc6bb1eb2660e74657fbf04cdd290b5aef905585c86051b34d43",
		"GO_SHA256=fd017e647ec28525e86ae8203236e0653242722a7436929b1f775744e26278e7",
		"https://golang.google.cn/dl/go${GO_VERSION}.linux-${GO_ARCH}.tar.gz",
		"curl -fsSL --continue-at - --connect-timeout 10 --max-time 180",
		"sha256sum -c -",
		"sha256sum -c - || { rm -f \"$GO_TARBALL\"; exit 1; }",
		"go env -w GOPROXY=https://goproxy.cn,direct",
		"go env -w 'GOSUMDB=sum.golang.org https://goproxy.cn/sumdb/sum.golang.org'",
	} {
		if !strings.Contains(command, expected) {
			t.Fatalf("Go runtime install command is missing %q:\n%s", expected, command)
		}
	}
	for _, forbidden := range []string{
		"apt-get $APT_ARGS install -y --no-install-recommends golang",
		"GOSUMDB=off",
	} {
		if strings.Contains(command, forbidden) {
			t.Fatalf("Go runtime install command contains forbidden %q:\n%s", forbidden, command)
		}
	}
	conditionalEnd := strings.Index(command, "\nfi\n")
	goInstallStart := strings.Index(command, "\nGO_VERSION=1.22.12")
	if conditionalEnd < 0 || goInstallStart < 0 || conditionalEnd > goInstallStart {
		t.Fatalf("Go archive install must run after the conditional base package fallback:\n%s", command)
	}
}

func TestRuntimeInstallCommandHasValidShellSyntax(t *testing.T) {
	command := runtimeInstallCommand(runtimeEnvironmentSpec{
		BaseImage: "localhost/devbox:bookworm",
		Languages: []runtimeLanguageSpec{{Name: "go"}},
	}, "https://mirrors.aliyun.com")

	check := exec.Command("sh", "-n")
	check.Stdin = strings.NewReader(command)
	if output, err := check.CombinedOutput(); err != nil {
		t.Fatalf(
			"runtime install command has invalid shell syntax: %v\n%s\n%s",
			err,
			output,
			command,
		)
	}
}

func TestRuntimeInstallCommandBoundsRequiredAptOperations(t *testing.T) {
	command := runtimeInstallCommand(runtimeEnvironmentSpec{
		BaseImage: "localhost/devbox:bookworm",
		Languages: []runtimeLanguageSpec{{Name: "python", Version: "3.11"}},
	}, "")

	for _, expected := range []string{
		"timeout --signal=TERM --kill-after=30s 300s apt-get $APT_ARGS update",
		"timeout --signal=TERM --kill-after=30s 300s apt-get $APT_ARGS install -y --no-install-recommends ca-certificates",
		"timeout --signal=TERM --kill-after=30s 300s apt-get $APT_ARGS install -y --no-install-recommends python3.11 python3.11-venv python3.11-dev",
	} {
		if !strings.Contains(command, expected) {
			t.Fatalf("runtime install command is missing bounded apt operation %q:\n%s", expected, command)
		}
	}
}

func TestRuntimeVerifyCommandRequiresPythonVirtualEnvironment(t *testing.T) {
	command := runtimeVerifyCommand(
		[]runtimeLanguageSpec{{Name: "python", Version: "3.11"}},
	)
	for _, expected := range []string{
		"command -v python3.11",
		"sys.version_info[:2] == (3, 11)",
		"python3.11 -c 'import ensurepip'",
		"missing runtime dependency: python3.11-venv",
	} {
		if !strings.Contains(command, expected) {
			t.Fatalf(
				"Python runtime verification is missing %q:\n%s",
				expected,
				command,
			)
		}
	}
}

func TestRuntimeInstallCommandInstallsPython311(t *testing.T) {
	command := runtimeInstallCommand(runtimeEnvironmentSpec{
		Languages: []runtimeLanguageSpec{{Name: "python", Version: "3.11"}},
	}, "")
	if !strings.Contains(
		command,
		"python3.11 python3.11-venv python3.11-dev",
	) {
		t.Fatalf("Python runtime install command does not enforce 3.11:\n%s", command)
	}
}

func TestProjectRuntimeProfilePrefersTechStackRuntimeProfile(t *testing.T) {
	got := projectRuntimeProfile(&model.Project{
		AppType:   "ai_agent",
		TechStack: `{"runtime":{"profile":"go-gin"}}`,
	})
	if got != "go-gin" {
		t.Fatalf("expected tech stack runtime profile to win, got %q", got)
	}
}
