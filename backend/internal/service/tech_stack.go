package service

import (
	"encoding/json"
	"strings"

	"yistack/internal/model"
)

// normalizePlanTechStack keeps structured tech_stack output canonical.
func normalizePlanTechStack(plan *model.Plan) {
	if plan == nil {
		return
	}

	profile := strings.TrimSpace(techStackRuntimeProfileRaw(plan.TechStack))
	if len(plan.TechStack) == 0 || string(plan.TechStack) == "null" {
		plan.TechStack = buildStructuredTechStack(profile, nil)
		return
	}

	var value interface{}
	if err := json.Unmarshal(plan.TechStack, &value); err != nil {
		plan.TechStack = buildStructuredTechStack(profile, []string{strings.TrimSpace(string(plan.TechStack))})
		return
	}

	switch typed := value.(type) {
	case map[string]interface{}:
		if profile != "" {
			ensureRuntimeProfile(typed, profile)
			normalized, _ := json.Marshal(typed)
			plan.TechStack = normalized
		}
	case []interface{}:
		labels := make([]string, 0, len(typed))
		for _, item := range typed {
			if text, ok := item.(string); ok && strings.TrimSpace(text) != "" {
				labels = append(labels, strings.TrimSpace(text))
			}
		}
		plan.TechStack = buildStructuredTechStack(profile, labels)
	default:
		plan.TechStack = buildStructuredTechStack(profile, nil)
	}
}

func buildStructuredTechStack(profile string, labels []string) json.RawMessage {
	stack := map[string]interface{}{
		"runtime": map[string]interface{}{
			"profile": strings.TrimSpace(profile),
		},
		"summary": labels,
	}

	frontend := map[string]interface{}{}
	backend := map[string]interface{}{}
	database := map[string]interface{}{}
	for _, label := range labels {
		lower := strings.ToLower(label)
		switch {
		case strings.Contains(lower, "next"):
			frontend["framework"] = "Next.js"
			backend["framework"] = "Next.js Route Handlers"
		case strings.Contains(lower, "react"):
			frontend["framework"] = "React"
		case strings.Contains(lower, "vue"):
			frontend["framework"] = "Vue"
		case strings.Contains(lower, "typescript"):
			frontend["language"] = "TypeScript"
		case strings.Contains(lower, "tailwind"):
			frontend["ui"] = "Tailwind CSS"
		case strings.Contains(lower, "fastapi"):
			backend["framework"] = "FastAPI"
		case strings.Contains(lower, "python"):
			backend["language"] = "Python"
		case strings.Contains(lower, "gin"):
			backend["framework"] = "Gin"
		case strings.Contains(lower, "go"):
			backend["language"] = "Go"
		case strings.Contains(lower, "supabase"):
			backend["preset"] = "supabase"
			database["type"] = "Supabase"
		}
	}
	if len(frontend) > 0 {
		stack["frontend"] = frontend
	}
	if len(backend) > 0 {
		stack["backend"] = backend
	}
	if len(database) > 0 {
		stack["database"] = database
	}

	encoded, _ := json.Marshal(stack)
	return encoded
}

func ensureRuntimeProfile(stack map[string]interface{}, profile string) {
	runtime, _ := stack["runtime"].(map[string]interface{})
	if runtime == nil {
		runtime = map[string]interface{}{}
		stack["runtime"] = runtime
	}
	if strings.TrimSpace(asString(runtime["profile"])) == "" {
		runtime["profile"] = profile
	}
}

func projectRuntimeProfile(project *model.Project) string {
	if project == nil {
		return ""
	}
	if profile := techStackRuntimeProfileString(project.TechStack); profile != "" {
		return profile
	}
	if strings.TrimSpace(project.PlanData) != "" {
		var plan struct {
			TechStack json.RawMessage `json:"tech_stack"`
		}
		if err := json.Unmarshal([]byte(project.PlanData), &plan); err == nil {
			if profile := techStackRuntimeProfileRaw(plan.TechStack); profile != "" {
				return profile
			}
		}
	}
	return runtimeProfileForAppType(project.AppType)
}

func runtimeProfileForAppType(appType string) string {
	switch strings.ToLower(strings.TrimSpace(appType)) {
	case "web", "website", "web_app", "webapp", "nextjs":
		return "node-nextjs"
	case "mobile", "mobile_app", "app":
		return "node-react"
	case "miniprogram", "mini_program", "wechat_miniprogram":
		return "node-react"
	case "desktop", "desktop_app":
		return "node-react"
	case "ai", "ai_agent", "agent":
		return "python-fastapi"
	default:
		return "default"
	}
}

func techStackRuntimeProfileString(raw string) string {
	return techStackRuntimeProfileRaw(json.RawMessage(strings.TrimSpace(raw)))
}

func techStackRuntimeProfileRaw(raw json.RawMessage) string {
	if len(raw) == 0 || string(raw) == "null" {
		return ""
	}
	var value interface{}
	if err := json.Unmarshal(raw, &value); err != nil {
		return ""
	}
	stack, ok := value.(map[string]interface{})
	if !ok {
		return ""
	}
	runtime, _ := stack["runtime"].(map[string]interface{})
	return strings.TrimSpace(asString(runtime["profile"]))
}

func techStackDisplayLabelsRaw(raw json.RawMessage) []string {
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}
	var value interface{}
	if err := json.Unmarshal(raw, &value); err != nil {
		return nil
	}
	return techStackDisplayLabels(value)
}

func techStackDisplayLabelsString(raw string) []string {
	var value interface{}
	if err := json.Unmarshal([]byte(strings.TrimSpace(raw)), &value); err != nil {
		return nil
	}
	return techStackDisplayLabels(value)
}

func techStackDisplayLabels(value interface{}) []string {
	labels := make([]string, 0, 6)
	add := func(v interface{}) {
		text := strings.TrimSpace(asString(v))
		if text == "" {
			return
		}
		for _, existing := range labels {
			if existing == text {
				return
			}
		}
		labels = append(labels, text)
	}

	switch typed := value.(type) {
	case []interface{}:
		for _, item := range typed {
			add(item)
		}
	case map[string]interface{}:
		if summary, ok := typed["summary"].([]interface{}); ok {
			for _, item := range summary {
				add(item)
			}
		}
		if frontend, ok := typed["frontend"].(map[string]interface{}); ok {
			add(frontend["language"])
			add(frontend["framework"])
			add(frontend["ui"])
		}
		if backend, ok := typed["backend"].(map[string]interface{}); ok {
			add(backend["language"])
			add(backend["framework"])
		}
		if database, ok := typed["database"].(map[string]interface{}); ok {
			add(database["type"])
		}
	}
	return labels
}

func asString(value interface{}) string {
	if text, ok := value.(string); ok {
		return text
	}
	return ""
}
