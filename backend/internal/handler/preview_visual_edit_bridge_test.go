package handler

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type trackingReadCloser struct {
	io.Reader
	closed bool
}

func (r *trackingReadCloser) Close() error {
	r.closed = true
	return nil
}

func TestPreviewVisualEditQueryLifecycle(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "https://preview.example/route?project=project-1&__yistack_visual_edit=1&keep=yes", nil)
	if !previewVisualEditRequested(request) {
		t.Fatal("visual edit request should be detected")
	}
	if previewVisualEditBridgeRequested(request) {
		t.Fatal("bridge script request must use its own flag")
	}
	stripPreviewVisualEditQuery(request)
	if request.URL.Query().Get("project") != "" || request.URL.Query().Get(previewVisualEditQuery) != "" {
		t.Fatalf("private preview query leaked upstream: %s", request.URL.RawQuery)
	}
	if request.URL.Query().Get("keep") != "yes" {
		t.Fatalf("application query must survive: %s", request.URL.RawQuery)
	}

	bridgeRequest := httptest.NewRequest(http.MethodGet, "https://preview.example/route?__yistack_visual_edit_bridge=1", nil)
	if !previewVisualEditBridgeRequested(bridgeRequest) {
		t.Fatal("bridge request should be detected")
	}
	if bridgeURL := previewVisualEditBridgeURL("/route", "project-1"); bridgeURL != "/route?__yistack_visual_edit_bridge=1&project=project-1" {
		t.Fatalf("unexpected bridge URL: %s", bridgeURL)
	}
}

func TestInjectPreviewVisualEditBridgeIntoHTML(t *testing.T) {
	body := "<!doctype html><html><head><title>Demo</title></head><body><main>Ready</main></body></html>"
	response := &http.Response{
		StatusCode:    http.StatusOK,
		Header:        http.Header{"Content-Type": []string{"text/html; charset=utf-8"}, "ETag": []string{"stale"}},
		Body:          io.NopCloser(strings.NewReader(body)),
		ContentLength: int64(len(body)),
	}
	if err := injectPreviewVisualEditBridge(response, "/dashboard", "project-1"); err != nil {
		t.Fatalf("inject visual edit bridge: %v", err)
	}
	updated, err := io.ReadAll(response.Body)
	if err != nil {
		t.Fatalf("read injected response: %v", err)
	}
	content := string(updated)
	bridgeTag := `<script src="/dashboard?__yistack_visual_edit_bridge=1&amp;project=project-1" data-yistack-visual-edit="visual_edit.v1"></script>`
	if !strings.Contains(content, bridgeTag) || strings.Index(content, bridgeTag) > strings.Index(content, "</body>") {
		t.Fatalf("bridge tag was not injected before body close: %s", content)
	}
	if response.Header.Get("ETag") != "" || response.Header.Get("Cache-Control") != "no-store, max-age=0" {
		t.Fatalf("injected response must not retain stale caching headers: %#v", response.Header)
	}
	if response.ContentLength != int64(len(updated)) || response.Header.Get("Content-Length") == "" {
		t.Fatal("injected response length was not updated")
	}
}

func TestInjectPreviewVisualEditBridgeSkipsNonHTMLAndCompressedResponses(t *testing.T) {
	tests := []struct {
		name    string
		headers http.Header
	}{
		{name: "json", headers: http.Header{"Content-Type": []string{"application/json"}}},
		{name: "misleading html suffix", headers: http.Header{"Content-Type": []string{"application/not-text/html"}}},
		{name: "compressed", headers: http.Header{"Content-Type": []string{"text/html"}, "Content-Encoding": []string{"gzip"}}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			body := "<html><body>unchanged</body></html>"
			response := &http.Response{StatusCode: http.StatusOK, Header: test.headers, Body: io.NopCloser(strings.NewReader(body)), ContentLength: int64(len(body))}
			if err := injectPreviewVisualEditBridge(response, "/", "project-1"); err != nil {
				t.Fatalf("inject visual edit bridge: %v", err)
			}
			actual, _ := io.ReadAll(response.Body)
			if string(actual) != body {
				t.Fatalf("response should remain unchanged: %s", actual)
			}
		})
	}
}

func TestInjectPreviewVisualEditBridgePreservesOversizedResponseAndClose(t *testing.T) {
	body := strings.Repeat("a", previewVisualEditMaxHTMLSize+1)
	originalBody := &trackingReadCloser{Reader: strings.NewReader(body)}
	response := &http.Response{
		StatusCode:    http.StatusOK,
		Header:        http.Header{"Content-Type": []string{"text/html"}},
		Body:          originalBody,
		ContentLength: -1,
	}
	if err := injectPreviewVisualEditBridge(response, "/", "project-1"); err != nil {
		t.Fatalf("inspect oversized visual edit response: %v", err)
	}
	actual, err := io.ReadAll(response.Body)
	if err != nil || string(actual) != body {
		t.Fatalf("oversized response was not preserved: bytes=%d err=%v", len(actual), err)
	}
	if originalBody.closed {
		t.Fatal("oversized response body closed before proxy consumption")
	}
	_ = response.Body.Close()
	if !originalBody.closed {
		t.Fatal("oversized response body close was not delegated")
	}
}

func TestPreviewVisualEditBridgeExcludesSensitiveBrowserData(t *testing.T) {
	for _, forbidden := range []string{
		"document.cookie",
		"localStorage",
		"sessionStorage",
		"outerHTML",
		"innerHTML",
		"window.location.search",
		"element.value",
		"defaultValue",
		"element.innerText",
	} {
		if strings.Contains(previewVisualEditBridgeScript, forbidden) {
			t.Fatalf("preview bridge must not access %s", forbidden)
		}
	}
	for _, required := range []string{
		"window.location.pathname",
		"event.source !== window.parent",
		"event.origin !== parentOrigin",
		"yistack:visual-edit-selection",
		"data-yistack-visual-edit-overlay",
		"element.isContentEditable",
		"INPUT|TEXTAREA|SELECT|OPTION",
		"element.childNodes",
	} {
		if !strings.Contains(previewVisualEditBridgeScript, required) {
			t.Fatalf("preview bridge is missing %s", required)
		}
	}
}
