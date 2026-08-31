package service

import (
	"bytes"
	"context"
	"embed"
	"io/fs"
	"strings"
	"text/template"
	"unicode"
)

//go:embed templates/project_docs/*.tmpl templates/project_scaffolds/node-nextjs/*.tmpl templates/project_scaffolds/node-nextjs/src/app/*.tmpl templates/project_scaffolds/python-fastapi/*.tmpl templates/project_scaffolds/go-gin/*.tmpl templates/project_scaffolds/default/*.tmpl
var projectTemplateFS embed.FS

var projectTemplatePatterns = []string{
	"templates/project_docs/*.tmpl",
	"templates/project_scaffolds/node-nextjs/*.tmpl",
	"templates/project_scaffolds/node-nextjs/src/app/*.tmpl",
	"templates/project_scaffolds/python-fastapi/*.tmpl",
	"templates/project_scaffolds/go-gin/*.tmpl",
	"templates/project_scaffolds/default/*.tmpl",
}

var compiledProjectTemplates = template.Must(compileProjectTemplates())

const projectTemplateConfigKeyPrefix = "template."

// renderProjectTemplate 渲染项目级模板资源，统一收口文档与兜底脚手架模板。
func renderProjectTemplate(name string, data any) string {
	return renderProjectTemplateSource(name, "", data)
}

func renderProjectTemplateWithConfig(ctx context.Context, systemConfigSvc *SystemConfigService, name string, data any) string {
	if override := lookupProjectTemplateOverride(ctx, systemConfigSvc, name); override != "" {
		if rendered := renderProjectTemplateSource(name, override, data); strings.TrimSpace(rendered) != "" {
			return rendered
		}
	}
	return renderProjectTemplate(name, data)
}

func lookupProjectTemplateOverride(ctx context.Context, systemConfigSvc *SystemConfigService, name string) string {
	if systemConfigSvc == nil {
		return ""
	}
	key := projectTemplateConfigKey(name)
	if key == "" {
		return ""
	}
	value, err := systemConfigSvc.GetConfig(ctx, key)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(value)
}

func projectTemplateConfigKey(name string) string {
	normalized := strings.TrimSpace(name)
	normalized = strings.TrimPrefix(normalized, "templates/")
	normalized = strings.TrimSuffix(normalized, ".tmpl")
	parts := strings.Split(normalized, "/")
	keyParts := make([]string, 0, len(parts))
	for _, part := range parts {
		part = sanitizeProjectTemplateConfigKeyPart(part)
		if part == "" {
			continue
		}
		keyParts = append(keyParts, part)
	}
	if len(keyParts) == 0 {
		return ""
	}
	return projectTemplateConfigKeyPrefix + strings.Join(keyParts, ".")
}

func sanitizeProjectTemplateConfigKeyPart(value string) string {
	value = strings.TrimSpace(value)
	var builder strings.Builder
	lastUnderscore := false
	for _, r := range value {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			builder.WriteRune(unicode.ToLower(r))
			lastUnderscore = false
			continue
		}
		if !lastUnderscore {
			builder.WriteByte('_')
			lastUnderscore = true
		}
	}
	return strings.Trim(builder.String(), "_")
}

func renderProjectTemplateSource(name string, source string, data any) string {
	var builder bytes.Buffer
	if strings.TrimSpace(source) == "" {
		if err := compiledProjectTemplates.ExecuteTemplate(&builder, name, data); err != nil {
			return ""
		}
		return strings.TrimSpace(builder.String()) + "\n"
	}
	tmpl, err := template.New(name).Parse(source)
	if err != nil {
		return ""
	}
	if err := tmpl.Execute(&builder, data); err != nil {
		return ""
	}
	return strings.TrimSpace(builder.String()) + "\n"
}

func compileProjectTemplates() (*template.Template, error) {
	root := template.New("project_templates")
	for _, pattern := range projectTemplatePatterns {
		matches, err := fs.Glob(projectTemplateFS, pattern)
		if err != nil {
			return nil, err
		}
		for _, name := range matches {
			content, err := projectTemplateFS.ReadFile(name)
			if err != nil {
				return nil, err
			}
			if _, err := root.New(name).Parse(string(content)); err != nil {
				return nil, err
			}
		}
	}
	return root, nil
}
