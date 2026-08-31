package service

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"io"
	"strings"
)

const deploymentSecretKeyVersion = "v1"

type deploymentSecretCipher struct{ aead cipher.AEAD }

func newDeploymentSecretCipher(rawKey string) (*deploymentSecretCipher, error) {
	key, err := decodeDeploymentSecretKey(rawKey)
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
	return &deploymentSecretCipher{aead: aead}, nil
}

func decodeDeploymentSecretKey(rawKey string) ([]byte, error) {
	rawKey = strings.TrimSpace(rawKey)
	decoders := []func(string) ([]byte, error){base64.RawURLEncoding.DecodeString, base64.StdEncoding.DecodeString, hex.DecodeString}
	for _, decode := range decoders {
		decoded, err := decode(rawKey)
		if err == nil && len(decoded) == 32 {
			return decoded, nil
		}
	}
	if len([]byte(rawKey)) == 32 {
		return []byte(rawKey), nil
	}
	return nil, errors.New("deployment secret encryption key must decode to exactly 32 bytes")
}

func (c *deploymentSecretCipher) Encrypt(plaintext []byte) (string, string, error) {
	if c == nil || c.aead == nil {
		return "", "", errors.New("deployment secret cipher is not available")
	}
	nonce := make([]byte, c.aead.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", "", err
	}
	sealed := c.aead.Seal(nil, nonce, plaintext, []byte(deploymentSecretKeyVersion))
	return base64.RawURLEncoding.EncodeToString(sealed), base64.RawURLEncoding.EncodeToString(nonce), nil
}

func (c *deploymentSecretCipher) Decrypt(ciphertext, nonce, version string) ([]byte, error) {
	if c == nil || c.aead == nil {
		return nil, errors.New("deployment secret cipher is not available")
	}
	if version != deploymentSecretKeyVersion {
		return nil, errors.New("unsupported deployment secret key version")
	}
	sealed, err := base64.RawURLEncoding.DecodeString(ciphertext)
	if err != nil {
		return nil, errors.New("invalid deployment secret ciphertext")
	}
	nonceBytes, err := base64.RawURLEncoding.DecodeString(nonce)
	if err != nil || len(nonceBytes) != c.aead.NonceSize() {
		return nil, errors.New("invalid deployment secret nonce")
	}
	plaintext, err := c.aead.Open(nil, nonceBytes, sealed, []byte(deploymentSecretKeyVersion))
	if err != nil {
		return nil, errors.New("decrypt deployment secrets failed")
	}
	return plaintext, nil
}
