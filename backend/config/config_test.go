package config

import "testing"

func TestResolveJWTSecretKeepsConfiguredSecret(t *testing.T) {
	secret, generated := resolveJWTSecret("configured-secret-value")
	if generated {
		t.Fatal("configured JWT secret must not be replaced")
	}
	if secret != "configured-secret-value" {
		t.Fatalf("unexpected JWT secret: %q", secret)
	}
}

func TestResolveJWTSecretReplacesEmptyAndInsecureValues(t *testing.T) {
	values := []string{
		"",
		insecureDefaultJWTSecret,
		"your-secret-key",
		"change-me",
	}

	for _, value := range values {
		t.Run(value, func(t *testing.T) {
			secret, generated := resolveJWTSecret(value)
			if !generated {
				t.Fatal("empty or insecure JWT secret must be replaced")
			}
			if len(secret) < 32 {
				t.Fatalf("generated JWT secret is too short: %d", len(secret))
			}
			if secret == value {
				t.Fatal("generated JWT secret must differ from the configured value")
			}
		})
	}
}

func TestResolveJWTSecretGeneratesDifferentValues(t *testing.T) {
	first, _ := resolveJWTSecret("")
	second, _ := resolveJWTSecret("")
	if first == second {
		t.Fatal("generated JWT secrets must be random")
	}
}
