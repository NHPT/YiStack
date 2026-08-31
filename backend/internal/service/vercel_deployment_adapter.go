package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"yistack/config"
)

type deploymentHTTPClient interface {
	Do(*http.Request) (*http.Response, error)
}

type vercelDeploymentAdapter struct {
	config config.DeploymentConfig
	client deploymentHTTPClient
}

type vercelHTTPError struct{ Status int }

func (e *vercelHTTPError) Error() string {
	return fmt.Sprintf("Vercel request returned status %d", e.Status)
}

type vercelProject struct {
	ID                string             `json:"id"`
	Name              string             `json:"name"`
	LatestDeployments []vercelDeployment `json:"latestDeployments"`
}
type vercelDeployment struct {
	ID           string `json:"id"`
	URL          string `json:"url"`
	ReadyState   string `json:"readyState"`
	Status       string `json:"status"`
	Target       string `json:"target"`
	ErrorCode    string `json:"errorCode"`
	ErrorMessage string `json:"errorMessage"`
}
type vercelFileReference struct {
	File string `json:"file"`
	SHA  string `json:"sha"`
	Size int64  `json:"size"`
}
type vercelVerification struct {
	Type   string `json:"type"`
	Domain string `json:"domain"`
	Value  string `json:"value"`
}
type vercelDomain struct {
	Name         string               `json:"name"`
	Verified     bool                 `json:"verified"`
	Verification []vercelVerification `json:"verification"`
}
type vercelEvent struct {
	Type    string      `json:"type"`
	Created json.Number `json:"created"`
	Payload struct {
		Text string `json:"text"`
		Info struct {
			Step       string `json:"step"`
			ReadyState string `json:"readyState"`
		} `json:"info"`
	} `json:"payload"`
}

func newVercelDeploymentAdapter(cfg config.DeploymentConfig) *vercelDeploymentAdapter {
	return &vercelDeploymentAdapter{config: cfg, client: &http.Client{Timeout: 60 * time.Second}}
}

func (a *vercelDeploymentAdapter) configured() bool {
	if a == nil || strings.TrimSpace(a.config.VercelAccessToken) == "" {
		return false
	}
	base := strings.TrimSpace(a.config.VercelAPIBaseURL)
	return strings.HasPrefix(base, "https://") || strings.HasPrefix(base, "http://127.0.0.1") || strings.HasPrefix(base, "http://localhost")
}

func (a *vercelDeploymentAdapter) ensureProject(ctx context.Context, name string) (*vercelProject, error) {
	var project vercelProject
	err := a.requestJSON(ctx, http.MethodGet, "/v9/projects/"+url.PathEscape(name), nil, &project)
	if err == nil {
		return &project, nil
	}
	var httpErr *vercelHTTPError
	if !errors.As(err, &httpErr) || httpErr.Status != http.StatusNotFound {
		return nil, err
	}
	body, _ := json.Marshal(map[string]interface{}{"name": name, "skipGitConnectDuringLink": true})
	if err := a.requestJSON(ctx, http.MethodPost, "/v11/projects", body, &project); err != nil {
		return nil, err
	}
	return &project, nil
}

func (a *vercelDeploymentAdapter) upsertEnvironment(ctx context.Context, projectID, target string, values map[string]string) error {
	if len(values) == 0 {
		return nil
	}
	items := make([]map[string]interface{}, 0, len(values))
	for key, value := range values {
		items = append(items, map[string]interface{}{"key": key, "value": value, "type": "sensitive", "target": []string{target}})
	}
	body, _ := json.Marshal(items)
	return a.requestJSON(ctx, http.MethodPost, "/v10/projects/"+url.PathEscape(projectID)+"/env?upsert=true", body, nil)
}

func (a *vercelDeploymentAdapter) uploadFile(ctx context.Context, digest string, content []byte) error {
	endpoint, err := a.endpoint("/v2/files")
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(content))
	if err != nil {
		return err
	}
	a.authorize(req)
	req.Header.Set("Content-Type", "application/octet-stream")
	req.Header.Set("Content-Length", strconv.Itoa(len(content)))
	req.Header.Set("x-Vercel-Digest", digest)
	resp, err := a.client.Do(req)
	if err != nil {
		return deploymentError("deployment_provider_request_failed", "Vercel file upload failed", err)
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return &vercelHTTPError{Status: resp.StatusCode}
	}
	return nil
}

func (a *vercelDeploymentAdapter) createDeployment(ctx context.Context, name, projectID, target, commitSHA, artifactSHA string, files []vercelFileReference) (*vercelDeployment, error) {
	payload := map[string]interface{}{
		"name": name, "project": projectID, "files": files,
		"meta": map[string]string{"yistackSourceCommit": commitSHA, "yistackArtifactSha256": artifactSHA},
	}
	if target == "production" {
		payload["target"] = "production"
	}
	body, _ := json.Marshal(payload)
	var deployment vercelDeployment
	if err := a.requestJSON(ctx, http.MethodPost, "/v13/deployments?forceNew=1&skipAutoDetectionConfirmation=1", body, &deployment); err != nil {
		return nil, err
	}
	return &deployment, nil
}

func (a *vercelDeploymentAdapter) getDeployment(ctx context.Context, deploymentID string) (*vercelDeployment, error) {
	var deployment vercelDeployment
	if err := a.requestJSON(ctx, http.MethodGet, "/v13/deployments/"+url.PathEscape(deploymentID), nil, &deployment); err != nil {
		return nil, err
	}
	return &deployment, nil
}

func (a *vercelDeploymentAdapter) currentProductionDeployment(ctx context.Context, projectID string) (string, error) {
	var project vercelProject
	if err := a.requestJSON(ctx, http.MethodGet, "/v9/projects/"+url.PathEscape(projectID), nil, &project); err != nil {
		return "", err
	}
	for index := range project.LatestDeployments {
		deployment := project.LatestDeployments[index]
		if strings.EqualFold(deployment.Target, "production") && normalizeVercelDeploymentStatus(&deployment) == "ready" {
			return deployment.ID, nil
		}
	}
	return "", nil
}

func (a *vercelDeploymentAdapter) getDeploymentEvents(ctx context.Context, deploymentID string) ([]vercelEvent, error) {
	var events []vercelEvent
	if err := a.requestJSON(ctx, http.MethodGet, "/v3/deployments/"+url.PathEscape(deploymentID)+"/events?direction=forward&limit=200", nil, &events); err != nil {
		return nil, err
	}
	return events, nil
}

func (a *vercelDeploymentAdapter) promote(ctx context.Context, projectID, deploymentID string) error {
	return a.requestJSON(ctx, http.MethodPost, "/v10/projects/"+url.PathEscape(projectID)+"/promote/"+url.PathEscape(deploymentID), []byte(`{}`), nil)
}

func (a *vercelDeploymentAdapter) addDomain(ctx context.Context, projectID, domain string) (*vercelDomain, error) {
	body, _ := json.Marshal(map[string]string{"name": domain})
	var result vercelDomain
	if err := a.requestJSON(ctx, http.MethodPost, "/v10/projects/"+url.PathEscape(projectID)+"/domains", body, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
func (a *vercelDeploymentAdapter) verifyDomain(ctx context.Context, projectID, domain string) (*vercelDomain, error) {
	var result vercelDomain
	if err := a.requestJSON(ctx, http.MethodPost, "/v9/projects/"+url.PathEscape(projectID)+"/domains/"+url.PathEscape(domain)+"/verify", []byte(`{}`), &result); err != nil {
		return nil, err
	}
	return &result, nil
}
func (a *vercelDeploymentAdapter) removeDomain(ctx context.Context, projectID, domain string) error {
	return a.requestJSON(ctx, http.MethodDelete, "/v9/projects/"+url.PathEscape(projectID)+"/domains/"+url.PathEscape(domain), []byte(`{"removeRedirects":false}`), nil)
}

func (a *vercelDeploymentAdapter) requestJSON(ctx context.Context, method, path string, body []byte, target interface{}) error {
	endpoint, err := a.endpoint(path)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, method, endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	a.authorize(req)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/json")
	resp, err := a.client.Do(req)
	if err != nil {
		return deploymentError("deployment_provider_request_failed", "Vercel request failed", err)
	}
	defer resp.Body.Close()
	responseBody, readErr := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if readErr != nil {
		return deploymentError("deployment_provider_response_invalid", "Vercel response could not be read", readErr)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return &vercelHTTPError{Status: resp.StatusCode}
	}
	if target != nil && len(responseBody) > 0 {
		if err := json.Unmarshal(responseBody, target); err != nil {
			return deploymentError("deployment_provider_response_invalid", "Vercel response was invalid", err)
		}
	}
	return nil
}

func (a *vercelDeploymentAdapter) endpoint(path string) (string, error) {
	base := strings.TrimRight(strings.TrimSpace(a.config.VercelAPIBaseURL), "/")
	if !strings.HasPrefix(base, "https://") && !strings.HasPrefix(base, "http://127.0.0.1") && !strings.HasPrefix(base, "http://localhost") {
		return "", deploymentError("deployment_provider_url_invalid", "Vercel API URL must use HTTPS", nil)
	}
	separator := "?"
	if strings.Contains(path, "?") {
		separator = "&"
	}
	if team := strings.TrimSpace(a.config.VercelTeamID); team != "" {
		path += separator + "teamId=" + url.QueryEscape(team)
	}
	return base + path, nil
}
func (a *vercelDeploymentAdapter) authorize(req *http.Request) {
	req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(a.config.VercelAccessToken))
}
