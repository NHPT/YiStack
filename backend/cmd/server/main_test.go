package main

import (
	"testing"

	"yistack/config"
)

func TestShouldLoadDotEnvHonorsSkipFlag(t *testing.T) {
	t.Setenv("YISTACK_SKIP_DOTENV", "")
	if shouldLoadDotEnv() != true {
		t.Fatal("expected dotenv loading by default")
	}

	t.Setenv("YISTACK_SKIP_DOTENV", " true ")
	if shouldLoadDotEnv() != false {
		t.Fatal("expected dotenv loading to be skipped when flag is true")
	}
}

func TestInitLLMClientRegistersExplicitDeterministicProvider(t *testing.T) {
	manager := initLLMClient(&config.Config{
		LLM: config.LLMConfig{
			ActiveProvider:       "deterministic",
			DeterministicEnabled: true,
			MaxTokens:            4096,
			Timeout:              120,
		},
	}, nil)

	if manager == nil {
		t.Fatal("expected provider manager")
	}
	if manager.GetCurrentName() != "deterministic" {
		t.Fatalf("expected deterministic provider to be active, got %q", manager.GetCurrentName())
	}
	providers := manager.ListProviders()
	if len(providers) != 1 || providers[0] != "deterministic" {
		t.Fatalf("expected only deterministic provider, got %#v", providers)
	}
}

func TestInitLLMClientKeepsDeterministicProviderDefaultOff(t *testing.T) {
	manager := initLLMClient(&config.Config{
		LLM: config.LLMConfig{
			ActiveProvider: "deterministic",
		},
	}, nil)

	if manager == nil {
		t.Fatal("expected provider manager")
	}
	if len(manager.ListProviders()) != 0 {
		t.Fatalf("expected no provider without explicit deterministic flag, got %#v", manager.ListProviders())
	}
}
