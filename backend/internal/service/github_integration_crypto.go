package service

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"io"
	"strings"
)

const githubTokenKeyVersion = "v1"

type githubTokenCipher struct {
	aead cipher.AEAD
}

func newGitHubTokenCipher(rawKey string) (*githubTokenCipher, error) {
	key, err := decodeGitHubEncryptionKey(rawKey)
	if err != nil {
		return nil, err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return &githubTokenCipher{aead: aead}, nil
}

func decodeGitHubEncryptionKey(rawKey string) ([]byte, error) {
	rawKey = strings.TrimSpace(rawKey)
	if rawKey == "" {
		return nil, errors.New("GitHub token encryption key is not configured")
	}
	decoders := []func(string) ([]byte, error){
		base64.RawURLEncoding.DecodeString,
		base64.StdEncoding.DecodeString,
		hex.DecodeString,
	}
	for _, decode := range decoders {
		decoded, err := decode(rawKey)
		if err == nil && len(decoded) == 32 {
			return decoded, nil
		}
	}
	if len([]byte(rawKey)) == 32 {
		return []byte(rawKey), nil
	}
	return nil, errors.New("GitHub token encryption key must decode to exactly 32 bytes")
}

func (c *githubTokenCipher) Encrypt(plaintext string) (ciphertext, nonce string, err error) {
	if c == nil || c.aead == nil {
		return "", "", errors.New("GitHub token cipher is not available")
	}
	nonceBytes := make([]byte, c.aead.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonceBytes); err != nil {
		return "", "", err
	}
	sealed := c.aead.Seal(nil, nonceBytes, []byte(plaintext), []byte(githubTokenKeyVersion))
	return base64.RawURLEncoding.EncodeToString(sealed),
		base64.RawURLEncoding.EncodeToString(nonceBytes), nil
}

func (c *githubTokenCipher) Decrypt(ciphertext, nonce, keyVersion string) (string, error) {
	if c == nil || c.aead == nil {
		return "", errors.New("GitHub token cipher is not available")
	}
	if strings.TrimSpace(keyVersion) != githubTokenKeyVersion {
		return "", errors.New("unsupported GitHub token key version")
	}
	ciphertextBytes, err := base64.RawURLEncoding.DecodeString(ciphertext)
	if err != nil {
		return "", errors.New("invalid GitHub token ciphertext")
	}
	nonceBytes, err := base64.RawURLEncoding.DecodeString(nonce)
	if err != nil || len(nonceBytes) != c.aead.NonceSize() {
		return "", errors.New("invalid GitHub token nonce")
	}
	plaintext, err := c.aead.Open(nil, nonceBytes, ciphertextBytes, []byte(githubTokenKeyVersion))
	if err != nil {
		return "", errors.New("decrypt GitHub token failed")
	}
	return string(plaintext), nil
}

func randomGitHubSecret(byteCount int) (string, error) {
	value := make([]byte, byteCount)
	if _, err := io.ReadFull(rand.Reader, value); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(value), nil
}

func githubSHA256(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}

func githubPKCEChallenge(verifier string) string {
	sum := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}
