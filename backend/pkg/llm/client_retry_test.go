package llm

import (
	"context"
	"errors"
	"io"
	"net"
	"net/http"
	"strings"
	"testing"
	"time"
)

type llmRoundTripFunc func(*http.Request) (*http.Response, error)

func (fn llmRoundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return fn(req)
}

func llmHTTPResponse(req *http.Request, status int, body string) *http.Response {
	return &http.Response{
		StatusCode: status,
		Header:     make(http.Header),
		Body:       io.NopCloser(strings.NewReader(body)),
		Request:    req,
	}
}

func TestClientChatRetriesTransientTransportFailure(t *testing.T) {
	client := NewClient("https://provider.example", "secret", time.Second)
	client.retryBaseDelay = time.Millisecond
	attempts := 0
	client.httpClient.Transport = llmRoundTripFunc(func(req *http.Request) (*http.Response, error) {
		attempts++
		if attempts == 1 {
			return nil, &net.OpError{Op: "dial", Net: "tcp", Err: errors.New("connection timed out")}
		}
		return llmHTTPResponse(req, http.StatusOK, `{"id":"response","choices":[{"message":{"role":"assistant","content":"ok"}}]}`), nil
	})

	response, err := client.Chat(context.Background(), &ChatRequest{
		Model:    "test-model",
		Messages: []Message{{Role: "user", Content: "hello"}},
	})
	if err != nil {
		t.Fatalf("expected retry to recover, got %v", err)
	}
	if attempts != 2 {
		t.Fatalf("expected 2 attempts, got %d", attempts)
	}
	if response == nil || len(response.Choices) != 1 || response.Choices[0].Message.Content != "ok" {
		t.Fatalf("unexpected response: %#v", response)
	}
}

func TestClientStreamChatRetriesRetryableStatusBeforeStreaming(t *testing.T) {
	client := NewClient("https://provider.example", "secret", time.Second)
	client.retryBaseDelay = time.Millisecond
	attempts := 0
	client.httpClient.Transport = llmRoundTripFunc(func(req *http.Request) (*http.Response, error) {
		attempts++
		if attempts == 1 {
			return llmHTTPResponse(req, http.StatusServiceUnavailable, "temporary outage"), nil
		}
		return llmHTTPResponse(req, http.StatusOK, "data: {\"choices\":[{\"delta\":{\"content\":\"ok\"}}]}\n\ndata: [DONE]\n\n"), nil
	})

	var content string
	err := client.StreamChat(context.Background(), &ChatRequest{
		Model:    "test-model",
		Messages: []Message{{Role: "user", Content: "hello"}},
		Stream:   true,
	}, func(chunk *StreamChunk) error {
		content += chunk.Choices[0].Delta["content"].(string)
		return nil
	})
	if err != nil {
		t.Fatalf("expected status retry to recover, got %v", err)
	}
	if attempts != 2 {
		t.Fatalf("expected 2 attempts, got %d", attempts)
	}
	if content != "ok" {
		t.Fatalf("expected streamed content, got %q", content)
	}
}

func TestClientChatUsesExtendedPreStreamRetryBudget(t *testing.T) {
	client := NewClient("https://provider.example", "secret", time.Second)
	client.retryBaseDelay = time.Microsecond
	attempts := 0
	client.httpClient.Transport = llmRoundTripFunc(func(req *http.Request) (*http.Response, error) {
		attempts++
		if attempts <= 5 {
			return nil, &net.OpError{Op: "dial", Net: "tcp", Err: errors.New("connection timed out")}
		}
		return llmHTTPResponse(req, http.StatusOK, `{"id":"response","choices":[{"message":{"role":"assistant","content":"recovered"}}]}`), nil
	})

	response, err := client.Chat(context.Background(), &ChatRequest{Model: "test-model"})
	if err != nil {
		t.Fatalf("extended pre-stream retry budget did not recover: %v", err)
	}
	if attempts != 6 {
		t.Fatalf("attempts = %d, want 6", attempts)
	}
	if response == nil || len(response.Choices) != 1 || response.Choices[0].Message.Content != "recovered" {
		t.Fatalf("unexpected response: %#v", response)
	}
}

type llmDelayedStreamBody struct {
	delay  time.Duration
	chunks []string
	index  int
}

func (body *llmDelayedStreamBody) Read(target []byte) (int, error) {
	if body.index >= len(body.chunks) {
		return 0, io.EOF
	}
	time.Sleep(body.delay)
	chunk := body.chunks[body.index]
	body.index++
	return copy(target, chunk), nil
}

func (body *llmDelayedStreamBody) Close() error {
	return nil
}

func TestClientStreamChatDoesNotUseSynchronousTotalTimeout(t *testing.T) {
	client := NewClient("https://provider.example", "secret", 50*time.Millisecond)
	client.httpClient.Transport = llmRoundTripFunc(func(req *http.Request) (*http.Response, error) {
		response := llmHTTPResponse(req, http.StatusOK, "")
		response.Body = &llmDelayedStreamBody{
			delay: 20 * time.Millisecond,
			chunks: []string{
				"data: {\"choices\":[{\"delta\":{\"content\":\"slow \"}}]}\n\n",
				"data: {\"choices\":[{\"delta\":{\"content\":\"stream\"}}]}\n\n",
				"data: [DONE]\n\n",
			},
		}
		return response, nil
	})

	var content string
	err := client.StreamChat(context.Background(), &ChatRequest{Model: "test-model", Stream: true}, func(chunk *StreamChunk) error {
		content += chunk.Choices[0].Delta["content"].(string)
		return nil
	})
	if err != nil {
		t.Fatalf("expected stream body to outlive synchronous timeout, got %v", err)
	}
	if content != "slow stream" {
		t.Fatalf("expected slow streamed content, got %q", content)
	}
}

type llmBlockingStreamBody struct {
	closed chan struct{}
}

func (body *llmBlockingStreamBody) Read(_ []byte) (int, error) {
	<-body.closed
	return 0, errors.New("stream body closed")
}

func (body *llmBlockingStreamBody) Close() error {
	select {
	case <-body.closed:
	default:
		close(body.closed)
	}
	return nil
}

func TestClientStreamChatStopsAfterReadIdleTimeout(t *testing.T) {
	client := NewClient("https://provider.example", "secret", 20*time.Millisecond)
	client.httpClient.Transport = llmRoundTripFunc(func(req *http.Request) (*http.Response, error) {
		response := llmHTTPResponse(req, http.StatusOK, "")
		response.Body = &llmBlockingStreamBody{closed: make(chan struct{})}
		return response, nil
	})

	startedAt := time.Now()
	err := client.StreamChat(
		context.Background(),
		&ChatRequest{Model: "test-model", Stream: true},
		func(*StreamChunk) error { return nil },
	)
	if err == nil || !strings.Contains(err.Error(), "stream idle timeout") {
		t.Fatalf("expected stream idle timeout, got %v", err)
	}
	if elapsed := time.Since(startedAt); elapsed > time.Second {
		t.Fatalf("stream idle timeout took too long: %s", elapsed)
	}
}

type llmReadErrorBody struct {
	sent bool
}

func (body *llmReadErrorBody) Read(target []byte) (int, error) {
	if body.sent {
		return 0, errors.New("stream interrupted")
	}
	body.sent = true
	return copy(target, "data: {\"choices\":[{\"delta\":{\"content\":\"partial\"}}]}\n\n"), nil
}

func (body *llmReadErrorBody) Close() error {
	return nil
}

func TestClientStreamChatDoesNotRetryAfterStreamingStarts(t *testing.T) {
	client := NewClient("https://provider.example", "secret", time.Second)
	client.retryBaseDelay = time.Millisecond
	attempts := 0
	client.httpClient.Transport = llmRoundTripFunc(func(req *http.Request) (*http.Response, error) {
		attempts++
		response := llmHTTPResponse(req, http.StatusOK, "")
		response.Body = &llmReadErrorBody{}
		return response, nil
	})

	err := client.StreamChat(context.Background(), &ChatRequest{Model: "test-model", Stream: true}, func(*StreamChunk) error {
		return nil
	})
	if err == nil || !strings.Contains(err.Error(), "failed to read stream") {
		t.Fatalf("expected stream read failure, got %v", err)
	}
	if attempts != 1 {
		t.Fatalf("expected no retry after streaming started, got %d attempts", attempts)
	}
}
