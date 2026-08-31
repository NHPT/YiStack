package file

import (
	"os"
	"path/filepath"
	"strings"

	"github.com/pkg/errors"
)

// TemplateType 模板类型
type TemplateType string

const (
	TemplateNodeNextJS    TemplateType = "node-nextjs"
	TemplateNodeReact     TemplateType = "node-react"
	TemplateNodeVue       TemplateType = "node-vue"
	TemplatePythonFastAPI TemplateType = "python-fastapi"
	TemplatePythonFlask   TemplateType = "python-flask"
	TemplateGoGin        TemplateType = "go-gin"
	TemplateStaticHTML    TemplateType = "static-html"
)

// TemplateInfo 模板信息
type TemplateInfo struct {
	Type        TemplateType `json:"type"`
	Name        string       `json:"name"`
	Description string       `json:"description"`
	Languages   []string     `json:"languages"`
	Port        int          `json:"port"`
}

// AllTemplates 所有可用模板
var AllTemplates = []TemplateInfo{
	{
		Type:        TemplateNodeNextJS,
		Name:        "Next.js (React)",
		Description: "全栈 React 框架，支持 SSR、API Routes",
		Languages:   []string{"TypeScript"},
		Port:        3000,
	},
	{
		Type:        TemplateNodeReact,
		Name:        "React + Vite",
		Description: "现代化 React 开发环境",
		Languages:   []string{"TypeScript", "JavaScript"},
		Port:        5173,
	},
	{
		Type:        TemplateNodeVue,
		Name:        "Vue 3 + Vite",
		Description: "渐进式 JavaScript 框架",
		Languages:   []string{"TypeScript", "JavaScript"},
		Port:        5173,
	},
	{
		Type:        TemplatePythonFastAPI,
		Name:        "Python FastAPI",
		Description: "现代化 Python Web 框架",
		Languages:   []string{"Python"},
		Port:        8000,
	},
	{
		Type:        TemplatePythonFlask,
		Name:        "Python Flask",
		Description: "轻量级 Python Web 框架",
		Languages:   []string{"Python"},
		Port:        5000,
	},
	{
		Type:        TemplateGoGin,
		Name:        "Go Gin",
		Description: "Go 语言高性能 Web 框架",
		Languages:   []string{"Go"},
		Port:        8080,
	},
	{
		Type:        TemplateStaticHTML,
		Name:        "Static HTML",
		Description: "静态 HTML 网站",
		Languages:   []string{"HTML", "CSS", "JavaScript"},
		Port:        3000,
	},
}

// TemplateInitializer 模板初始化器
type TemplateInitializer struct{}

// NewTemplateInitializer 创建模板初始化器
func NewTemplateInitializer() *TemplateInitializer {
	return &TemplateInitializer{}
}

// InitFromTemplate 从模板初始化项目
func (ti *TemplateInitializer) InitFromTemplate(projectDir string, templateType TemplateType, projectName string) error {
	switch templateType {
	case TemplateNodeNextJS:
		return ti.initNodeNextJS(projectDir, projectName)
	case TemplateNodeReact:
		return ti.initNodeReact(projectDir, projectName)
	case TemplateNodeVue:
		return ti.initNodeVue(projectDir, projectName)
	case TemplatePythonFastAPI:
		return ti.initPythonFastAPI(projectDir, projectName)
	case TemplatePythonFlask:
		return ti.initPythonFlask(projectDir, projectName)
	case TemplateGoGin:
		return ti.initGoGin(projectDir, projectName)
	case TemplateStaticHTML:
		return ti.initStaticHTML(projectDir, projectName)
	default:
		return ti.initStaticHTML(projectDir, projectName)
	}
}

// initNodeNextJS 初始化 Next.js 项目
func (ti *TemplateInitializer) initNodeNextJS(projectDir, projectName string) error {
	files := map[string]string{
		"package.json": `{
  "name": "` + projectName + `",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "next": "14.0.4"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "@types/node": "^20.10.6",
    "@types/react": "^18.2.46",
    "@types/react-dom": "^18.2.18"
  }
}`,
		"tsconfig.json": `{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}`,
		"next.config.js": `/** @type {import('next').NextConfig} */
const nextConfig = {}
module.exports = nextConfig`,
		"src/app/layout.tsx": `import './globals.css'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}`,
		"src/app/page.tsx": `export default function Home() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Welcome to YiStack</h1>
      <p>This is a Next.js project template.</p>
    </main>
  )
}`,
		"src/app/globals.css": `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  line-height: 1.6;
  color: #333;
}`,
		"README.md": "# " + projectName + "\n\nNext.js project template.\n\n## Quick Start\n\n```bash\nnpm install\nnpm run dev\n```\n\nVisit http://localhost:3000\n",
	}

	return ti.writeFiles(projectDir, files)
}

// initNodeReact 初始化 React + Vite 项目
func (ti *TemplateInitializer) initNodeReact(projectDir, projectName string) error {
	files := map[string]string{
		"package.json": `{
  "name": "` + projectName + `",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.3.3",
    "vite": "^5.0.8"
  }
}`,
		"vite.config.ts": `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})`,
		"tsconfig.json": `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}`,
		"tsconfig.node.json": `{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}`,
		"index.html": `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>` + projectName + `</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
		"src/main.tsx": `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`,
		"src/App.tsx": `function App() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Welcome to YiStack</h1>
      <p>This is a React + Vite project.</p>
    </div>
  )
}

export default App`,
		"src/index.css": `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  line-height: 1.6;
  color: #333;
}`,
		"README.md": "# " + projectName + "\n\nReact + Vite project template.\n\n## Quick Start\n\n```bash\nnpm install\nnpm run dev\n```\n\nVisit http://localhost:5173\n",
	}

	return ti.writeFiles(projectDir, files)
}

// initNodeVue 初始化 Vue 3 项目
func (ti *TemplateInitializer) initNodeVue(projectDir, projectName string) error {
	files := map[string]string{
		"package.json": `{
  "name": "` + projectName + `",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "vue": "^3.3.11"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^4.5.2",
    "typescript": "^5.3.3",
    "vite": "^5.0.8",
    "vue-tsc": "^1.8.25"
  }
}`,
		"vite.config.ts": `import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
})`,
		"tsconfig.json": `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "preserve",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"],
  "references": [{ "path": "./tsconfig.node.json" }]
}`,
		"tsconfig.node.json": `{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}`,
		"index.html": `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>` + projectName + `</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>`,
		"src/main.ts": `import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

createApp(App).mount('#app')`,
		"src/App.vue": `<template>
  <div class="app">
    <h1>Welcome to YiStack</h1>
    <p>This is a Vue 3 project.</p>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.app {
  padding: 2rem;
  font-family: system-ui, sans-serif;
}
</style>`,
		"src/style.css": `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  line-height: 1.6;
  color: #333;
}`,
		"README.md": "# " + projectName + "\n\nVue 3 project template.\n\n## Quick Start\n\n```bash\nnpm install\nnpm run dev\n```\n\nVisit http://localhost:5173\n",
	}

	return ti.writeFiles(projectDir, files)
}

// initPythonFastAPI 初始化 FastAPI 项目
func (ti *TemplateInitializer) initPythonFastAPI(projectDir, projectName string) error {
	files := map[string]string{
		"requirements.txt": "fastapi==0.109.0\nuvicorn[standard]==0.27.0\npydantic==2.5.3",
		"main.py": `from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="` + projectName + `")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Welcome to YiStack", "project": "` + projectName + `"}`,
		"README.md": "# " + projectName + "\n\nFastAPI project template.\n\n## Quick Start\n\n```bash\npip install -r requirements.txt\nuvicorn main:app --reload\n```\n\nVisit http://localhost:8000\n\nAPI docs: http://localhost:8000/docs\n",
	}

	return ti.writeFiles(projectDir, files)
}

// initPythonFlask 初始化 Flask 项目
func (ti *TemplateInitializer) initPythonFlask(projectDir, projectName string) error {
	files := map[string]string{
		"requirements.txt": "flask==3.0.0\nflask-cors==4.0.0",
		"app.py": `from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route("/")
def index():
    return jsonify({
        "message": "Welcome to YiStack",
        "project": "` + projectName + `"
    })

if __name__ == "__main__":
    app.run(debug=True, port=5000)`,
		"README.md": "# " + projectName + "\n\nFlask project template.\n\n## Quick Start\n\n```bash\npip install -r requirements.txt\npython app.py\n```\n\nVisit http://localhost:5000\n",
	}

	return ti.writeFiles(projectDir, files)
}

// initGoGin 初始化 Gin 项目
func (ti *TemplateInitializer) initGoGin(projectDir, projectName string) error {
	moduleName := strings.ReplaceAll(projectName, "-", "_")
	files := map[string]string{
		"go.mod": "module " + moduleName + "\n\ngo 1.21\n\nrequire github.com/gin-gonic/gin v1.9.1",
		"main.go": `package main

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

func main() {
	r := gin.Default()

	// CORS configuration
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	})

	r.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "Welcome to YiStack",
			"project": "` + projectName + `",
		})
	})

	log.Println("Server running at http://localhost:8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatal(err)
	}
}`,
		"README.md": "# " + projectName + "\n\nGin project template.\n\n## Quick Start\n\n```bash\ngo mod tidy\ngo run main.go\n```\n\nVisit http://localhost:8080\n",
	}

	return ti.writeFiles(projectDir, files)
}

// initStaticHTML 初始化静态 HTML 项目
func (ti *TemplateInitializer) initStaticHTML(projectDir, projectName string) error {
	files := map[string]string{
		"index.html": `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>` + projectName + `</title>
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        body {
            font-family: system-ui, -apple-system, sans-serif;
            line-height: 1.6;
            color: #333;
            padding: 2rem;
        }
        h1 {
            color: #2563eb;
            margin-bottom: 1rem;
        }
        p {
            color: #666;
        }
    </style>
</head>
<body>
    <h1>Welcome to YiStack</h1>
    <p>This is a static HTML project template.</p>
</body>
</html>`,
		"README.md": "# " + projectName + "\n\nStatic HTML project template.\n\nOpen index.html in browser to preview.\n",
	}

	return ti.writeFiles(projectDir, files)
}

// writeFiles 写入多个文件
func (ti *TemplateInitializer) writeFiles(baseDir string, files map[string]string) error {
	for relPath, content := range files {
		fullPath := filepath.Join(baseDir, relPath)

		// 确保目录存在
		dir := filepath.Dir(fullPath)
		if err := os.MkdirAll(dir, 0755); err != nil {
			return errors.Wrap(err, "failed to create directory: "+dir)
		}

		// 写入文件
		if err := os.WriteFile(fullPath, []byte(content), 0644); err != nil {
			return errors.Wrap(err, "failed to write file: "+relPath)
		}
	}

	return nil
}

// GetTemplateInfo 获取模板信息
func GetTemplateInfo(templateType TemplateType) *TemplateInfo {
	for _, t := range AllTemplates {
		if t.Type == templateType {
			return &t
		}
	}
	return nil
}
