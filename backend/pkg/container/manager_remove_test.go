package container

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
)

func TestRemoveContainerReturnsProjectNetworkRemovalFailure(t *testing.T) {
	requestCount := 0
	client := &PodmanClient{
		baseURL: "http://d",
		client: &http.Client{
			Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				requestCount++
				switch {
				case req.Method == http.MethodGet &&
					req.URL.Path == "/v1.40/containers/json":
					return &http.Response{
						StatusCode: http.StatusOK,
						Body:       io.NopCloser(strings.NewReader("[]")),
						Header:     make(http.Header),
					}, nil
				case req.Method == http.MethodDelete &&
					req.URL.Path == "/v1.40/networks/yistack_project-1_net":
					return &http.Response{
						StatusCode: http.StatusInternalServerError,
						Body:       io.NopCloser(strings.NewReader(`{"message":"network is still in use"}`)),
						Header:     make(http.Header),
					}, nil
				default:
					t.Fatalf("unexpected Podman request: %s %s", req.Method, req.URL.String())
					return nil, nil
				}
			}),
		},
	}
	manager := &Manager{
		podman:     client,
		portPool:   NewPortPool(30000, 30010),
		containers: make(map[string]*ContainerInfo),
	}

	err := manager.RemoveContainer(context.Background(), "project-1")
	if err == nil || !strings.Contains(err.Error(), "remove network for project project-1") {
		t.Fatalf("RemoveContainer() error = %v", err)
	}
	if requestCount != 2 {
		t.Fatalf("Podman request count = %d, want 2", requestCount)
	}
}
