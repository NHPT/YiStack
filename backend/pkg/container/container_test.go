package container

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os/exec"
	"strings"
	"sync"
	"testing"
	"time"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return fn(req)
}

func appendDockerRawFrame(target []byte, streamType byte, payload string) []byte {
	header := make([]byte, 8)
	header[0] = streamType
	binary.BigEndian.PutUint32(header[4:], uint32(len(payload)))
	target = append(target, header...)
	target = append(target, []byte(payload)...)
	return target
}

func TestDemuxDockerRawStreamSplitsStdoutAndStderr(t *testing.T) {
	var payload []byte
	payload = appendDockerRawFrame(payload, 1, "tsconfig.json\n")
	payload = appendDockerRawFrame(payload, 2, "warning\n")
	payload = appendDockerRawFrame(payload, 1, "package.json\n")

	stdout, stderr, ok := demuxDockerRawStream(payload)
	if ok != true {
		t.Fatal("expected docker raw stream to be detected")
	}
	if stdout != "tsconfig.json\npackage.json\n" {
		t.Fatalf("unexpected stdout: %q", stdout)
	}
	if stderr != "warning\n" {
		t.Fatalf("unexpected stderr: %q", stderr)
	}
}

func TestDemuxDockerRawStreamRejectsPlainOutput(t *testing.T) {
	stdout, stderr, ok := demuxDockerRawStream([]byte("tsconfig.json\n"))
	if ok != false {
		t.Fatalf("expected plain output to bypass demux, got stdout=%q stderr=%q", stdout, stderr)
	}
}

func TestExecRunSeparatesControlAndCommandTimeouts(t *testing.T) {
	var deadlines []time.Duration
	var createRequest ExecCreateRequest
	responses := []struct {
		status int
		body   string
	}{
		{status: http.StatusCreated, body: `{"Id":"exec-1"}`},
		{status: http.StatusOK, body: ""},
		{status: http.StatusOK, body: `{"Running":false,"ExitCode":0}`},
	}
	requestIndex := 0
	client := &PodmanClient{
		baseURL: "http://d",
		client: &http.Client{
			Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				deadline, ok := req.Context().Deadline()
				if !ok {
					t.Fatalf("request %d has no deadline", requestIndex)
				}
				deadlines = append(deadlines, time.Until(deadline))
				if requestIndex == 0 {
					if err := json.NewDecoder(req.Body).Decode(&createRequest); err != nil {
						t.Fatalf("decode exec create request: %v", err)
					}
				}
				response := responses[requestIndex]
				requestIndex++
				return &http.Response{
					StatusCode: response.status,
					Body:       io.NopCloser(strings.NewReader(response.body)),
					Header:     make(http.Header),
				}, nil
			}),
		},
	}

	result, err := client.ExecRun(context.Background(), "container-1", RunOptions{
		Args:    []string{"test", "-e", "/workspace/package.json"},
		Env:     []string{"GIT_TERMINAL_PROMPT=0", "SECRET=value"},
		WorkDir: "/workspace",
		Timeout: 1,
	})
	if err != nil {
		t.Fatalf("expected exec to succeed, got %v", err)
	}
	if result.ExitCode != 0 {
		t.Fatalf("expected exit code 0, got %d", result.ExitCode)
	}
	if strings.Join(createRequest.Env, ",") != "GIT_TERMINAL_PROMPT=0,SECRET=value" {
		t.Fatalf("expected controlled exec environment, got %#v", createRequest.Env)
	}
	if len(deadlines) != 3 {
		t.Fatalf("expected three Podman requests, got %d", len(deadlines))
	}
	if deadlines[0] < 4*time.Minute || deadlines[2] < 4*time.Minute {
		t.Fatalf("expected control-plane deadlines near %s, got %v", podmanExecControlTimeout, deadlines)
	}
	if deadlines[1] <= 0 || deadlines[1] > 2*time.Second {
		t.Fatalf("expected command deadline near one second, got %s", deadlines[1])
	}
}

func findFreePortRange(t *testing.T, count int) (int, int) {
	t.Helper()

	for start := 20000; start <= 60000-count; start++ {
		listeners := make([]net.Listener, 0, count)
		available := true
		for port := start; port < start+count; port++ {
			ln, err := net.Listen("tcp", fmt.Sprintf("0.0.0.0:%d", port))
			if err != nil {
				available = false
				break
			}
			listeners = append(listeners, ln)
		}
		for _, ln := range listeners {
			_ = ln.Close()
		}
		if available {
			return start, start + count - 1
		}
	}

	t.Fatalf("could not find %d contiguous free ports for test", count)
	return 0, 0
}

func TestInitGitRepoCreatesRepositoryOnMainBranch(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git is not available")
	}

	projectDir := t.TempDir()
	if err := initGitRepo(projectDir); err != nil {
		t.Fatalf("expected git repo initialization to succeed, got %v", err)
	}

	if output, err := exec.Command("git", "-C", projectDir, "rev-parse", "--is-inside-work-tree").CombinedOutput(); err != nil {
		t.Fatalf("expected initialized git repository, got %v: %s", err, strings.TrimSpace(string(output)))
	}
	output, err := exec.Command("git", "-C", projectDir, "symbolic-ref", "--short", "HEAD").CombinedOutput()
	if err != nil {
		t.Fatalf("expected current branch to be readable, got %v: %s", err, strings.TrimSpace(string(output)))
	}
	if branch := strings.TrimSpace(string(output)); branch != "main" {
		t.Fatalf("expected main branch, got %q", branch)
	}
}

func TestNewPortPool(t *testing.T) {
	pool := NewPortPool(30000, 30010)

	if pool.rangeStart != 30000 {
		t.Errorf("expected rangeStart 30000, got %d", pool.rangeStart)
	}
	if pool.rangeEnd != 30010 {
		t.Errorf("expected rangeEnd 30010, got %d", pool.rangeEnd)
	}
	if pool.allocated == nil {
		t.Error("expected allocated map to be initialized")
	}
	if pool.projectPorts == nil {
		t.Error("expected projectPorts map to be initialized")
	}
}

func TestManagerMarkProjectActiveUpdatesLastActiveAt(t *testing.T) {
	previous := time.Now().Add(-time.Hour)
	manager := &Manager{
		containers: map[string]*ContainerInfo{
			"proj_active": {
				ProjectID:    "proj_active",
				ContainerID:  "container_1",
				Status:       ContainerStatusRunning,
				LastActiveAt: previous,
			},
		},
	}

	manager.MarkProjectActive("proj_active")

	updated := manager.containers["proj_active"].LastActiveAt
	if !updated.After(previous) {
		t.Fatalf("expected LastActiveAt to move forward, previous=%s updated=%s", previous, updated)
	}
}

func TestManagerIdleReaperEvaluatesPredicateOnlyAfterTimeout(t *testing.T) {
	now := time.Now()
	manager := &Manager{
		cfg: &Config{
			IdleTimeout: 30 * time.Minute,
		},
		containers: map[string]*ContainerInfo{
			"proj_recent": {
				ProjectID:    "proj_recent",
				ContainerID:  "container_recent",
				Status:       ContainerStatusRunning,
				LastActiveAt: now.Add(-time.Minute),
			},
			"proj_idle": {
				ProjectID:    "proj_idle",
				ContainerID:  "container_idle",
				Status:       ContainerStatusRunning,
				LastActiveAt: now.Add(-time.Hour),
			},
		},
	}

	var evaluated []string
	manager.stopIdleContainers(
		context.Background(),
		now,
		func(projectID string, _ *ContainerInfo) bool {
			evaluated = append(evaluated, projectID)
			manager.MarkProjectActive(projectID)
			return false
		},
		nil,
	)

	if len(evaluated) != 1 || evaluated[0] != "proj_idle" {
		t.Fatalf(
			"expected predicate only for timed-out project, got %v",
			evaluated,
		)
	}
	if updated := manager.containers["proj_idle"].LastActiveAt; !updated.After(now) {
		t.Fatalf("expected protected idle project activity to refresh, got %s", updated)
	}
}

func TestPortPool_Allocate(t *testing.T) {
	start, end := findFreePortRange(t, 6)
	pool := NewPortPool(start, end)

	// 分配第一个端口
	port1, token1, err := pool.Allocate("project-1")
	if err != nil {
		t.Fatalf("allocate failed: %v", err)
	}
	if port1 != start {
		t.Errorf("expected port %d, got %d", start, port1)
	}
	if token1 == "" {
		t.Error("expected non-empty token")
	}

	// 分配第二个端口
	port2, _, err := pool.Allocate("project-2")
	if err != nil {
		t.Fatalf("allocate failed: %v", err)
	}
	if port2 != start+1 {
		t.Errorf("expected port %d, got %d", start+1, port2)
	}

	// 同一项目再次分配应返回同一端口
	port1Again, token1Again, err := pool.Allocate("project-1")
	if err != nil {
		t.Fatalf("allocate failed: %v", err)
	}
	if port1Again != port1 {
		t.Errorf("expected same port %d, got %d", port1, port1Again)
	}
	if token1Again != token1 {
		t.Errorf("expected same token %s, got %s", token1, token1Again)
	}
}

func TestPortPool_AllocateExhausted(t *testing.T) {
	start, end := findFreePortRange(t, 3)
	pool := NewPortPool(start, end)

	// allocate all ports
	for i := 0; i < 3; i++ {
		_, _, err := pool.Allocate("project-" + string(rune('1'+i)))
		if err != nil {
			t.Fatalf("allocate %d failed: %v", i, err)
		}
	}

	// extra allocation should fail
	_, _, err := pool.Allocate("project-extra")
	if err == nil {
		t.Error("expected error when pool is exhausted")
	}
}

func TestPortPool_Release(t *testing.T) {
	start, end := findFreePortRange(t, 6)
	pool := NewPortPool(start, end)

	// 分配并释放
	port, _, err := pool.Allocate("project-1")
	if err != nil {
		t.Fatalf("allocate failed: %v", err)
	}

	err = pool.Release("project-1")
	if err != nil {
		t.Fatalf("release failed: %v", err)
	}

	// 端口应可再次分配
	port2, _, err := pool.Allocate("project-2")
	if err != nil {
		t.Fatalf("allocate after release failed: %v", err)
	}
	if port2 != port {
		t.Errorf("expected released port %d, got %d", port, port2)
	}
}

func TestPortPool_GetPort(t *testing.T) {
	start, end := findFreePortRange(t, 6)
	pool := NewPortPool(start, end)

	// 未分配的项目
	port, exists := pool.GetPort("non-existent")
	if exists {
		t.Error("expected port not to exist")
	}

	// 分配后获取
	_, _, err := pool.Allocate("project-1")
	if err != nil {
		t.Fatalf("allocate failed: %v", err)
	}

	port, exists = pool.GetPort("project-1")
	if !exists {
		t.Error("expected port to exist")
	}
	if port != start {
		t.Errorf("expected port %d, got %d", start, port)
	}
}

func TestPortPool_GetStats(t *testing.T) {
	start, end := findFreePortRange(t, 6)
	pool := NewPortPool(start, end)

	stats := pool.GetStats()
	if stats.TotalPorts != 6 {
		t.Errorf("expected 6 total ports, got %d", stats.TotalPorts)
	}
	if stats.AvailablePorts != 6 {
		t.Errorf("expected 6 available ports, got %d", stats.AvailablePorts)
	}
	if stats.UsedPorts != 0 {
		t.Errorf("expected 0 used ports, got %d", stats.UsedPorts)
	}

	// 分配后统计
	if _, _, err := pool.Allocate("project-1"); err != nil {
		t.Fatalf("allocate failed: %v", err)
	}
	stats = pool.GetStats()
	if stats.UsedPorts != 1 {
		t.Errorf("expected 1 used port, got %d", stats.UsedPorts)
	}
	if stats.AvailablePorts != 5 {
		t.Errorf("expected 5 available ports, got %d", stats.AvailablePorts)
	}
}

func TestPortPool_Concurrent(t *testing.T) {
	start, end := findFreePortRange(t, 60)
	pool := NewPortPool(start, end)

	var wg sync.WaitGroup
	ports := make(chan int, 50)

	// concurrently allocate 50 ports
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			port, _, err := pool.Allocate(fmt.Sprintf("project-%d", id))
			if err != nil {
				t.Errorf("concurrent allocate failed: %v", err)
				return
			}
			ports <- port
		}(i)
	}
	wg.Wait()
	close(ports)

	// check port uniqueness
	portMap := make(map[int]bool)
	for port := range ports {
		if portMap[port] {
			t.Errorf("duplicate port %d allocated", port)
		}
		portMap[port] = true
	}
}

func TestPortPool_IsPortAvailable(t *testing.T) {
	start, end := findFreePortRange(t, 6)
	pool := NewPortPool(start, end)

	// 范围内且未分配
	if !pool.IsPortAvailable(start) {
		t.Errorf("expected port %d to be available", start)
	}

	// 范围外
	if pool.IsPortAvailable(start - 1) {
		t.Errorf("expected port %d to be unavailable", start-1)
	}
	if pool.IsPortAvailable(end + 1) {
		t.Errorf("expected port %d to be unavailable", end+1)
	}

	// 分配后不可用
	if _, _, err := pool.Allocate("project-1"); err != nil {
		t.Fatalf("allocate failed: %v", err)
	}
	if pool.IsPortAvailable(start) {
		t.Errorf("expected port %d to be unavailable after allocation", start)
	}
}

func TestPortPool_AllocateSpecific(t *testing.T) {
	start, end := findFreePortRange(t, 6)
	pool := NewPortPool(start, end)
	specificPort := start + 3

	// 分配指定端口
	token, err := pool.AllocateSpecific("project-1", specificPort)
	if err != nil {
		t.Fatalf("allocate specific failed: %v", err)
	}
	if token == "" {
		t.Error("expected non-empty token")
	}

	// 获取端口确认
	port, exists := pool.GetPort("project-1")
	if !exists || port != specificPort {
		t.Errorf("expected port %d, got %v", specificPort, port)
	}

	// 再次分配同一端口应失败
	_, err = pool.AllocateSpecific("project-2", specificPort)
	if err == nil {
		t.Error("expected error when allocating already allocated port")
	}
}

func TestPortPool_Reserve(t *testing.T) {
	start, end := findFreePortRange(t, 6)
	pool := NewPortPool(start, end)
	reservedPort := start + 2

	if err := pool.Reserve("project-1", reservedPort); err != nil {
		t.Fatalf("reserve failed: %v", err)
	}

	port, exists := pool.GetPort("project-1")
	if !exists || port != reservedPort {
		t.Fatalf("expected reserved port %d, got %d exists=%v", reservedPort, port, exists)
	}

	if _, _, err := pool.Allocate("project-2"); err != nil {
		t.Fatalf("allocate after reserve failed: %v", err)
	}
	if pool.IsPortAvailable(reservedPort) {
		t.Fatalf("expected reserved port %d to be unavailable", reservedPort)
	}
}

func TestPortPool_AllocateSkipsOccupiedHostPort(t *testing.T) {
	start, end := findFreePortRange(t, 2)
	ln, err := net.Listen("tcp", fmt.Sprintf("0.0.0.0:%d", start))
	if err != nil {
		t.Fatalf("listen failed: %v", err)
	}
	defer ln.Close()

	occupiedPort := start
	pool := NewPortPool(start, end)

	port, _, err := pool.Allocate("project-1")
	if err != nil {
		t.Fatalf("allocate failed: %v", err)
	}
	if port != end {
		t.Fatalf("expected allocator to skip occupied host port %d, got %d", occupiedPort, port)
	}
}

func TestPortPool_CleanupReleased(t *testing.T) {
	start, end := findFreePortRange(t, 6)
	pool := NewPortPool(start, end)

	// allocate and release
	if _, _, err := pool.Allocate("project-1"); err != nil {
		t.Fatalf("allocate failed: %v", err)
	}
	pool.Release("project-1")

	// cleanup with 0 duration should cleanup released ports
	cleaned := pool.CleanupReleased(0)
	if cleaned != 1 {
		t.Errorf("expected 1 cleaned, got %d", cleaned)
	}

	// allocate and release, cleanup with 1 hour (should not cleanup recent)
	if _, _, err := pool.Allocate("project-2"); err != nil {
		t.Fatalf("allocate failed: %v", err)
	}
	pool.Release("project-2")
	cleaned = pool.CleanupReleased(time.Hour)
	if cleaned != 0 {
		t.Errorf("expected 0 cleaned (recent release), got %d", cleaned)
	}
}

func TestValidatePort(t *testing.T) {
	tests := []struct {
		port    int
		wantErr bool
	}{
		{30000, false},
		{40000, false},
		{65535, false},
		{29999, true},
		{0, true},
		{-1, true},
	}

	for _, tt := range tests {
		err := ValidatePort(tt.port)
		if (err != nil) != tt.wantErr {
			t.Errorf("ValidatePort(%d) error = %v, wantErr %v", tt.port, err, tt.wantErr)
		}
	}
}

func TestContainerName(t *testing.T) {
	tests := []struct {
		projectID string
		expected  string
	}{
		{"proj-001", "yistack_proj-001"},
		{"abc123", "yistack_abc123"},
		{"", "yistack_"},
	}

	for _, tt := range tests {
		result := containerName(tt.projectID)
		if result != tt.expected {
			t.Errorf("containerName(%s) = %s, want %s", tt.projectID, result, tt.expected)
		}
	}
}

func TestTrimContainerPrefix(t *testing.T) {
	tests := []struct {
		name     string
		expected string
	}{
		{"/yistack_proj-001", "yistack_proj-001"},
		{"yistack_proj-001", "yistack_proj-001"},
		{"/", ""},
		{"", ""},
	}

	for _, tt := range tests {
		result := trimContainerPrefix(tt.name)
		if result != tt.expected {
			t.Errorf("trimContainerPrefix(%s) = %s, want %s", tt.name, result, tt.expected)
		}
	}
}

func TestExtractProjectID(t *testing.T) {
	tests := []struct {
		name     string
		expected string
	}{
		{"yistack_proj-001", "proj-001"},
		{"/yistack_proj-001", "proj-001"},
		{"yistack_", ""},
		{"short", ""},
	}

	for _, tt := range tests {
		result := extractProjectID(tt.name)
		if result != tt.expected {
			t.Errorf("extractProjectID(%s) = %s, want %s", tt.name, result, tt.expected)
		}
	}
}

func TestImageForProjectType(t *testing.T) {
	tests := []struct {
		projectType ProjectType
		expected    string
	}{
		{ProjectTypeNodeNext, DefaultWorkspaceImage},
		{ProjectTypeNodeReact, DefaultWorkspaceImage},
		{ProjectTypeNodeVue, DefaultWorkspaceImage},
		{ProjectTypeNodeExpress, DefaultWorkspaceImage},
		{ProjectTypePythonFastAPI, DefaultWorkspaceImage},
		{ProjectTypePythonDjango, DefaultWorkspaceImage},
		{ProjectTypeGoGin, DefaultWorkspaceImage},
		{ProjectTypeGoFiber, DefaultWorkspaceImage},
		{ProjectTypeStaticHTML, DefaultWorkspaceImage},
	}

	for _, tt := range tests {
		result := imageForProjectType(tt.projectType)
		if result != tt.expected {
			t.Errorf("imageForProjectType(%s) = %s, want %s", tt.projectType, result, tt.expected)
		}
	}
}

func TestBuildImageCandidatesPrefersDockerHubForDaocloudMirror(t *testing.T) {
	candidates := buildImageCandidates("docker.m.daocloud.io/library/golang:1.26-alpine")
	expected := []string{
		"docker.io/library/golang:1.26-alpine",
	}

	if len(candidates) != len(expected) {
		t.Fatalf("buildImageCandidates returned %d candidates, want %d: %#v", len(candidates), len(expected), candidates)
	}
	for i := range expected {
		if candidates[i] != expected[i] {
			t.Fatalf("candidate[%d] = %s, want %s; all candidates: %#v", i, candidates[i], expected[i], candidates)
		}
	}
}

func TestBuildImageCandidatesDoesNotAddDaocloudMirrorForDockerHub(t *testing.T) {
	candidates := buildImageCandidates("docker.io/library/python:3.11-slim")
	expected := []string{"docker.io/library/python:3.11-slim"}

	if len(candidates) != len(expected) {
		t.Fatalf("buildImageCandidates returned %d candidates, want %d: %#v", len(candidates), len(expected), candidates)
	}
	if candidates[0] != expected[0] {
		t.Fatalf("candidate[0] = %s, want %s", candidates[0], expected[0])
	}
}

func TestPullImageErrorDetailDetectsErrorBody(t *testing.T) {
	body := []byte(`{"cause":"image not known","message":"localhost/devbox:bookworm: image not known","response":404}`)

	detail := pullImageErrorDetail(body)
	if detail == "" {
		t.Fatal("expected pull image error detail")
	}
	if detail != "localhost/devbox:bookworm: image not known: image not known" {
		t.Fatalf("pullImageErrorDetail() = %q", detail)
	}
}

func TestPullImageErrorDetailIgnoresProgressBody(t *testing.T) {
	body := []byte(`{"status":"Pulling from library/debian"}
{"status":"Download complete"}
{"status":"Digest: sha256:abc"}`)

	if detail := pullImageErrorDetail(body); detail != "" {
		t.Fatalf("expected no pull image error detail, got %q", detail)
	}
}

func TestIsNotFound(t *testing.T) {
	if !IsNotFound(ErrProjectNotFound) {
		t.Error("expected ErrProjectNotFound to be not found error")
	}
	if !IsNotFound(ErrContainerNotFound) {
		t.Error("expected ErrContainerNotFound to be not found error")
	}
	if !IsNotFound(ErrImageNotFound) {
		t.Error("expected ErrImageNotFound to be not found error")
	}
}

func TestIsRunning(t *testing.T) {
	if !IsRunning(ErrContainerRunning) {
		t.Error("expected ErrContainerRunning to be running error")
	}
}

func TestIsStopped(t *testing.T) {
	if !IsStopped(ErrContainerStopped) {
		t.Error("expected ErrContainerStopped to be stopped error")
	}
}
