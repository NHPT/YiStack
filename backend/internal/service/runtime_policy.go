package service

import (
	"sort"
	"strings"

	"yistack/config"
)

const defaultRuntimeImage = "localhost/devbox:bookworm"
const (
	runtimeStrategyDynamicInstall = "dynamic_install"
	runtimeStrategyPrebuilt       = "prebuilt"
)

var runtimeProfileAliases = map[string][]string{
	"default":        {"default"},
	"node-nextjs":    {"node-next", "node-nextjs"},
	"node-react":     {"node-react"},
	"node-vue":       {"node-vue"},
	"node-express":   {"node-express"},
	"python-fastapi": {"python", "python-fastapi"},
	"python-django":  {"python-django"},
	"python-flask":   {"python-flask"},
	"go-gin":         {"go", "go-gin"},
	"go-fiber":       {"go-fiber"},
	"php-laravel":    {"php", "php-laravel", "laravel"},
	"static-html":    {"static", "static-html"},
}

// projectNeedsRuntime 判断项目是否需要开发运行时。
// 为保护宿主机，所有项目的生成、修改、删除、调试和运行都必须在容器中执行。
func projectNeedsRuntime(appType string) bool {
	return true
}

// canonicalRuntimeProfile 将配置别名归一化到统一 runtime profile。
func canonicalRuntimeProfile(runtimeProfile string) string {
	normalized := strings.TrimSpace(runtimeProfile)
	if normalized == "" {
		return ""
	}
	for canonical, aliases := range runtimeProfileAliases {
		for _, alias := range aliases {
			if normalized == alias {
				return canonical
			}
		}
	}
	return normalized
}

// runtimeProfileMatches 比较两个 runtime profile 是否语义等价，避免别名导致的配置失配。
func runtimeProfileMatches(configProfile, runtimeProfile string) bool {
	configProfile = canonicalRuntimeProfile(configProfile)
	runtimeProfile = canonicalRuntimeProfile(runtimeProfile)
	return configProfile != "" && configProfile == runtimeProfile
}

// getImageForRuntimeProfile 为 ProjectService 选择当前运行配置对应的开发镜像。
func (s *ProjectService) getImageForRuntimeProfile(runtimeProfile string) string {
	selected, _ := selectRuntimeImage(runtimeProfile, s.containerCfg)
	return selected.Image
}

// getImageForRuntimeProfile 为 GeneratorService 选择当前运行配置对应的开发镜像。
func (s *GeneratorService) getImageForRuntimeProfile(runtimeProfile string) string {
	selected, _ := selectRuntimeImage(runtimeProfile, s.containerCfg)
	return selected.Image
}

// selectRuntimeImage 按 runtime profile 选择开发镜像。
// 优先命中数据库配置里的 profile 专用镜像，未命中时再回退到 default 默认镜像。
func selectRuntimeImage(runtimeProfile string, containerCfg *config.ContainerConfig) (config.ContainerImage, string) {
	profile := canonicalRuntimeProfile(runtimeProfile)
	images := runtimeImageCandidates(containerCfg)

	for _, image := range images {
		if runtimeProfileMatches(image.Type, profile) && strings.TrimSpace(image.Image) != "" {
			strategy := resolveRuntimeImageStrategy(image)
			return finalizeRuntimeImage(image, strategy), strategy
		}
	}

	for _, image := range images {
		if runtimeProfileMatches(image.Type, "default") && strings.TrimSpace(image.Image) != "" {
			strategy := runtimeFallbackImageStrategy(profile)
			return finalizeRuntimeImage(image, strategy), strategy
		}
	}

	strategy := runtimeFallbackImageStrategy(profile)
	return finalizeRuntimeImage(config.ContainerImage{
		Type:     "default",
		Image:    defaultRuntimeImage,
		Priority: 1000,
	}, strategy), strategy
}

func resolveRuntimeImageStrategy(image config.ContainerImage) string {
	_ = image
	return runtimeStrategyPrebuilt
}

func runtimeFallbackImageStrategy(profile string) string {
	profile = canonicalRuntimeProfile(profile)
	if profile == "" || profile == "default" {
		return runtimeStrategyPrebuilt
	}
	return runtimeStrategyDynamicInstall
}

func runtimeImageCandidates(containerCfg *config.ContainerConfig) []config.ContainerImage {
	if containerCfg == nil || len(containerCfg.Images) == 0 {
		return nil
	}

	candidates := make([]config.ContainerImage, 0, len(containerCfg.Images))
	for _, image := range containerCfg.Images {
		if !runtimeImageEnabled(image) {
			continue
		}
		if strings.TrimSpace(image.Image) == "" {
			continue
		}
		candidates = append(candidates, image)
	}

	sort.SliceStable(candidates, func(i, j int) bool {
		if candidates[i].Priority == candidates[j].Priority {
			return candidates[i].Type < candidates[j].Type
		}
		return candidates[i].Priority < candidates[j].Priority
	})
	return candidates
}

func runtimeImageEnabled(image config.ContainerImage) bool {
	if image.Enabled == nil {
		return true
	}
	return *image.Enabled
}

func finalizeRuntimeImage(image config.ContainerImage, strategy string) config.ContainerImage {
	image.Type = canonicalRuntimeProfile(image.Type)
	image.Image = normalizeRuntimeImage(image.Image)
	if image.Port <= 0 {
		image.Port = defaultPortForRuntimeStrategy(image.Type, strategy)
	}
	return image
}

func defaultPortForRuntimeStrategy(runtimeProfile, strategy string) int {
	if strategy == runtimeStrategyDynamicInstall {
		return 3000
	}
	switch canonicalRuntimeProfile(runtimeProfile) {
	case "node-react", "node-vue":
		return 5173
	case "python-fastapi", "python-django", "python-flask":
		return 8000
	case "go-gin", "go-fiber":
		return 8080
	case "php-laravel":
		return 8000
	default:
		return 3000
	}
}

func inferRuntimeImageStrategy(runtimeProfile, image string, containerCfg *config.ContainerConfig) string {
	image = normalizeRuntimeImage(image)
	if strings.TrimSpace(image) == "" {
		return runtimeStrategyPrebuilt
	}

	selected, strategy := selectRuntimeImage(runtimeProfile, containerCfg)
	if selected.Image == image {
		return strategy
	}
	return runtimeStrategyPrebuilt
}

// normalizeRuntimeImage 将历史镜像源归一化为稳定的 Docker Hub 引用。
// 旧版本曾写入 docker.m.daocloud.io 镜像源，该镜像源可能返回 image not known。
func normalizeRuntimeImage(image string) string {
	trimmed := strings.TrimSpace(image)
	if strings.HasPrefix(trimmed, "docker.m.daocloud.io/") {
		return "docker.io/" + strings.TrimPrefix(trimmed, "docker.m.daocloud.io/")
	}
	return trimmed
}
