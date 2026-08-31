package service

import (
	"context"
	"errors"
	"testing"

	"yistack/internal/model"
)

type stubSystemConfigRepo struct {
	values map[string]string
	err    error
}

func (r *stubSystemConfigRepo) Get(_ context.Context, key string) (*model.SystemConfig, error) {
	if r.err != nil {
		return nil, r.err
	}
	value, ok := r.values[key]
	if !ok {
		return nil, errors.New("config not found")
	}
	return &model.SystemConfig{Key: key, Value: value}, nil
}

func (r *stubSystemConfigRepo) Set(_ context.Context, key, value string) error {
	if r.values == nil {
		r.values = map[string]string{}
	}
	r.values[key] = value
	return nil
}

func (r *stubSystemConfigRepo) List(context.Context) ([]model.SystemConfig, error) {
	return nil, nil
}

func (r *stubSystemConfigRepo) InitDefaults(context.Context) error {
	return nil
}

func TestProjectTemplateConfigKeyUsesStablePathDerivedNames(t *testing.T) {
	cases := map[string]string{
		"templates/project_docs/REQUIREMENTS.md.tmpl":                   "template.project_docs.requirements_md",
		"templates/project_scaffolds/node-nextjs/package.json.tmpl":     "template.project_scaffolds.node_nextjs.package_json",
		"templates/project_scaffolds/node-nextjs/src/app/page.tsx.tmpl": "template.project_scaffolds.node_nextjs.src.app.page_tsx",
		"templates/project_scaffolds/node-nextjs/.gitignore.tmpl":       "template.project_scaffolds.node_nextjs.gitignore",
	}

	for name, expected := range cases {
		if actual := projectTemplateConfigKey(name); actual != expected {
			t.Fatalf("expected %q to map to %q, got %q", name, expected, actual)
		}
	}
}

func TestRenderProjectTemplateWithConfigUsesOverride(t *testing.T) {
	configSvc := NewSystemConfigService(&stubSystemConfigRepo{
		values: map[string]string{
			"template.project_docs.requirements_md": "# {{ .ProjectName }} custom requirements",
		},
	})

	rendered := renderProjectTemplateWithConfig(context.Background(), configSvc, "templates/project_docs/REQUIREMENTS.md.tmpl", projectDocTemplateData{
		ProjectName: "Demo App",
	})

	if rendered != "# Demo App custom requirements\n" {
		t.Fatalf("expected configured template to render, got %q", rendered)
	}
}

func TestRenderProjectTemplateWithConfigFallsBackToBuiltinTemplate(t *testing.T) {
	configSvc := NewSystemConfigService(&stubSystemConfigRepo{
		values: map[string]string{
			"template.project_docs.requirements_md": "{{ .Missing",
		},
	})

	rendered := renderProjectTemplateWithConfig(context.Background(), configSvc, "templates/project_docs/REQUIREMENTS.md.tmpl", projectDocTemplateData{
		ProjectName:     "Demo App",
		AppType:         "web",
		RuntimeProfile:  "node-nextjs",
		FeatureList:     "- feature",
		PlanDescription: "plan",
	})

	if rendered == "" || rendered == "{{ .Missing\n" {
		t.Fatalf("expected invalid configured template to fall back to built-in template, got %q", rendered)
	}
}

func TestRenderProjectTemplateWithConfigIgnoresMissingConfig(t *testing.T) {
	configSvc := NewSystemConfigService(&stubSystemConfigRepo{err: errors.New("database unavailable")})

	rendered := renderProjectTemplateWithConfig(context.Background(), configSvc, "templates/project_docs/DESIGN.md.tmpl", projectDocTemplateData{
		ProjectName:     "Demo App",
		AppType:         "web",
		RuntimeProfile:  "node-nextjs",
		FeatureList:     "- feature",
		PlanDescription: "plan",
	})

	if rendered == "" {
		t.Fatal("expected built-in template when system_config lookup fails")
	}
}
