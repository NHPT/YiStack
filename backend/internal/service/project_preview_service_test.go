package service

import "testing"

func TestPreviewSlugRoundTrip(t *testing.T) {
	projectID := "proj_20260625010022oPb9YgKd"
	slug := EncodeProjectPreviewSlug(projectID)
	if slug == "" {
		t.Fatal("expected preview slug")
	}

	decoded, ok := DecodeProjectPreviewSlug(slug)
	if !ok {
		t.Fatal("expected preview slug to decode")
	}
	if decoded != projectID {
		t.Fatalf("expected %s, got %s", projectID, decoded)
	}
}

func TestProjectIDFromPreviewHost(t *testing.T) {
	projectID := "proj_20260625010022oPb9YgKd"
	host := EncodeProjectPreviewSlug(projectID) + ".preview.example.com"

	decoded, ok := ProjectIDFromPreviewHost(host, "preview.example.com")
	if !ok {
		t.Fatal("expected project id from preview host")
	}
	if decoded != projectID {
		t.Fatalf("expected %s, got %s", projectID, decoded)
	}
}
