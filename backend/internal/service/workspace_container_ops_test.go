package service

import "testing"

func TestNormalizeProjectRelativePathRejectsReplacementRune(t *testing.T) {
	if _, err := normalizeProjectRelativePath("\u0001\ufffd\ufffdtsconfig.json"); err == nil {
		t.Fatal("expected replacement-rune path to be rejected")
	}
}

func TestNormalizeProjectRelativePathAcceptsCleanProjectPath(t *testing.T) {
	path, err := normalizeProjectRelativePath(" ./src/../tsconfig.json ")
	if err != nil {
		t.Fatalf("expected clean path to be accepted, got %v", err)
	}
	if path != "tsconfig.json" {
		t.Fatalf("expected normalized path, got %q", path)
	}
}
