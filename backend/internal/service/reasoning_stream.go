package service

import "strings"

type reasoningStreamBuffer struct {
	pending strings.Builder
	flush   func(string) error
}

func newReasoningStreamBuffer(flush func(string) error) *reasoningStreamBuffer {
	return &reasoningStreamBuffer{flush: flush}
}

func (b *reasoningStreamBuffer) Append(chunk string) error {
	if b == nil || b.flush == nil || !hasVisibleText(chunk) {
		return nil
	}
	b.pending.WriteString(chunk)
	return b.flushReady(false)
}

func (b *reasoningStreamBuffer) Flush() error {
	if b == nil || b.flush == nil {
		return nil
	}
	return b.flushReady(true)
}

func (b *reasoningStreamBuffer) flushReady(force bool) error {
	for {
		text := b.pending.String()
		if text == "" {
			return nil
		}

		boundary := reasoningFlushBoundary(text, force)
		if boundary <= 0 {
			return nil
		}

		segment := strings.TrimSpace(text[:boundary])
		remainder := strings.TrimLeft(text[boundary:], "\r\n")
		if segment != "" {
			if err := b.flush(segment); err != nil {
				return err
			}
		}

		b.pending.Reset()
		b.pending.WriteString(remainder)
		force = force && b.pending.Len() > 0
	}
}

func reasoningFlushBoundary(text string, force bool) int {
	lastBoundary := 0
	lastWhitespace := 0
	runeCount := 0

	for index, r := range text {
		runeCount++
		switch r {
		case '\n', '。', '！', '？', '.', '!', '?':
			lastBoundary = index + len(string(r))
		case ' ', '\t':
			lastWhitespace = index + len(string(r))
		}
	}

	if lastBoundary > 0 {
		return lastBoundary
	}
	if runeCount >= 96 && lastWhitespace > 0 {
		return lastWhitespace
	}
	if force {
		return len(text)
	}
	return 0
}
