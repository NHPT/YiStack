package service

import "strings"

func normalizeEscapedSourceWhitespace(content string) string {
	const (
		sourceStateNormal = iota
		sourceStateSingleQuote
		sourceStateDoubleQuote
		sourceStateTemplate
		sourceStateRegex
		sourceStateLineComment
		sourceStateBlockComment
	)

	var normalized strings.Builder
	normalized.Grow(len(content))
	state := sourceStateNormal
	escaped := false
	regexCharacterClass := false

	for index := 0; index < len(content); index++ {
		current := content[index]

		if state == sourceStateLineComment {
			if current == '\n' {
				state = sourceStateNormal
				normalized.WriteByte(current)
				continue
			}
			if current == '\\' {
				if replacement, consumed, ok := escapedSourceWhitespaceAt(content, index); ok {
					normalized.WriteString(replacement)
					index += consumed - 1
					if strings.Contains(replacement, "\n") {
						state = sourceStateNormal
					}
					continue
				}
			}
			normalized.WriteByte(current)
			continue
		}

		if state == sourceStateBlockComment {
			if current == '*' && index+1 < len(content) && content[index+1] == '/' {
				normalized.WriteString("*/")
				index++
				state = sourceStateNormal
				continue
			}
			if current == '\\' {
				if replacement, consumed, ok := escapedSourceWhitespaceAt(content, index); ok {
					normalized.WriteString(replacement)
					index += consumed - 1
					continue
				}
			}
			normalized.WriteByte(current)
			continue
		}

		if state != sourceStateNormal {
			normalized.WriteByte(current)
			if escaped {
				escaped = false
				continue
			}
			if current == '\\' {
				escaped = true
				continue
			}
			if state == sourceStateRegex {
				switch current {
				case '[':
					regexCharacterClass = true
				case ']':
					regexCharacterClass = false
				case '/':
					if !regexCharacterClass {
						state = sourceStateNormal
					}
				}
				continue
			}
			if (state == sourceStateSingleQuote && current == '\'') ||
				(state == sourceStateDoubleQuote && current == '"') ||
				(state == sourceStateTemplate && current == '`') {
				state = sourceStateNormal
			}
			continue
		}

		switch current {
		case '\'':
			state = sourceStateSingleQuote
		case '"':
			state = sourceStateDoubleQuote
		case '`':
			state = sourceStateTemplate
		case '/':
			if index+1 < len(content) {
				switch content[index+1] {
				case '/':
					normalized.WriteString("//")
					index++
					state = sourceStateLineComment
					continue
				case '*':
					normalized.WriteString("/*")
					index++
					state = sourceStateBlockComment
					continue
				}
			}
			if escapedSourceSlashStartsRegex(content, index) {
				state = sourceStateRegex
				regexCharacterClass = false
			}
		case '\\':
			if replacement, consumed, ok := escapedSourceWhitespaceAt(content, index); ok {
				normalized.WriteString(replacement)
				index += consumed - 1
				continue
			}
		}
		normalized.WriteByte(current)
	}

	return normalized.String()
}

func escapedSourceWhitespaceAt(content string, index int) (string, int, bool) {
	if index < 0 || index+1 >= len(content) || content[index] != '\\' {
		return "", 0, false
	}
	if strings.HasPrefix(content[index:], `\r\n`) {
		return "\r\n", 4, true
	}
	switch content[index+1] {
	case 'n':
		return "\n", 2, true
	case 'r':
		return "\r", 2, true
	case 't':
		return "\t", 2, true
	default:
		return "", 0, false
	}
}

func escapedSourceSlashStartsRegex(content string, index int) bool {
	for previous := index - 1; previous >= 0; previous-- {
		switch content[previous] {
		case ' ', '\t', '\r', '\n':
			continue
		case '(', '[', '{', '=', ':', ',', ';', '!', '?',
			'&', '|', '+', '-', '*', '%', '^', '~', '>':
			return true
		default:
			return false
		}
	}
	return true
}

func hasMisplacedUseClientDirective(content string) bool {
	lines := strings.Split(content, "\n")
	for index, line := range lines {
		if !isUseClientDirective(line) {
			continue
		}
		for previous := 0; previous < index; previous++ {
			if strings.TrimSpace(lines[previous]) != "" {
				return true
			}
		}
	}
	return false
}

func normalizeUseClientDirectivePlacement(content string) string {
	lines := strings.Split(content, "\n")
	withoutDirective := make([]string, 0, len(lines))
	found := false
	for _, line := range lines {
		if isUseClientDirective(line) {
			found = true
			continue
		}
		withoutDirective = append(withoutDirective, line)
	}
	if !found {
		return content
	}

	normalized := strings.Join(withoutDirective, "\n")
	if strings.Contains(normalized, "export default async function") {
		return strings.TrimLeft(normalized, "\n")
	}
	return `"use client";` + "\n" + strings.TrimLeft(normalized, "\n")
}

func isUseClientDirective(line string) bool {
	trimmed := strings.TrimSpace(line)
	trimmed = strings.TrimSuffix(trimmed, ";")
	return trimmed == `"use client"` || trimmed == `'use client'`
}
