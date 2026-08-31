package prompt

import (
	"bytes"
	"embed"
	"strings"
	"text/template"
)

//go:embed templates/*.tmpl
var promptTemplateFS embed.FS

var compiledPromptTemplates = template.Must(template.New("prompts").ParseFS(promptTemplateFS, "templates/*.tmpl"))

// renderPromptTemplate 渲染内置提示词模板，统一收口 prompt 模板资源的加载方式。
func renderPromptTemplate(name string, data any) string {
	var builder bytes.Buffer
	if err := compiledPromptTemplates.ExecuteTemplate(&builder, name, data); err != nil {
		return ""
	}
	return strings.TrimSpace(builder.String())
}
