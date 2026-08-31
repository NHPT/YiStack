// Package file 提供项目文件系统管理功能
package file

import (
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
	"github.com/pkg/errors"
)

// FileType 文件类型
type FileType string

const (
	FileTypeFile FileType = "file"
	FileTypeDir  FileType = "directory"
)

// FileNode 文件树节点
type FileNode struct {
	ID         string     `json:"id"`         // 唯一 ID
	Name       string     `json:"name"`       // 文件/目录名
	Path       string     `json:"path"`       // 相对于项目根目录的路径
	Type       FileType   `json:"type"`       // file 或 directory
	Children   []*FileNode `json:"children,omitempty"` // 子节点（仅目录有）
	Language   string     `json:"language,omitempty"`  // 编程语言（仅文件有）
	IsExpanded bool       `json:"isExpanded,omitempty"` // 是否展开（前端使用）
}

// ProjectManager 项目文件管理器
type ProjectManager struct {
	projectDir string // 项目根目录
}

// NewProjectManager 创建项目文件管理器
func NewProjectManager(projectDir string) (*ProjectManager, error) {
	// 确保项目目录存在
	if err := os.MkdirAll(projectDir, 0755); err != nil {
		return nil, errors.Wrap(err, "failed to create project directory")
	}
	return &ProjectManager{
		projectDir: projectDir,
	}, nil
}

// ProjectDir 返回项目根目录
func (pm *ProjectManager) ProjectDir() string {
	return pm.projectDir
}

// GetFileTree 获取项目文件树
func (pm *ProjectManager) GetFileTree() (*FileNode, error) {
	root, err := pm.buildFileTree(pm.projectDir, "")
	if err != nil {
		return nil, err
	}
	return root, nil
}

// buildFileTree 递归构建文件树
func (pm *ProjectManager) buildFileTree(basePath, relPath string) (*FileNode, error) {
	fullPath := filepath.Join(basePath, relPath)
	info, err := os.Stat(fullPath)
	if err != nil {
		return nil, errors.Wrap(err, "failed to stat path: "+fullPath)
	}

	// 跳过隐藏目录和特殊目录
	name := filepath.Base(relPath)
	if name == "" {
		name = filepath.Base(basePath)
	}
	if strings.HasPrefix(name, ".") || name == "node_modules" || name == "__pycache__" {
		if info.IsDir() {
			return &FileNode{
				ID:       uuid.New().String(),
				Name:     name,
				Path:     relPath,
				Type:     FileTypeDir,
				Children: []*FileNode{},
			}, nil
		}
		return nil, nil
	}

	node := &FileNode{
		ID:   uuid.New().String(),
		Name: name,
		Path: relPath,
	}

	if info.IsDir() {
		node.Type = FileTypeDir
		node.IsExpanded = false

		// 读取目录内容
		entries, err := os.ReadDir(fullPath)
		if err != nil {
			return nil, errors.Wrap(err, "failed to read directory: "+fullPath)
		}

		for _, entry := range entries {
			childPath := filepath.Join(relPath, entry.Name())
			child, err := pm.buildFileTree(basePath, childPath)
			if err != nil {
				continue // 跳过无法访问的文件
			}
			if child != nil {
				node.Children = append(node.Children, child)
			}
		}

		// 按名称排序
		sortFileNodes(node.Children)
	} else {
		node.Type = FileTypeFile
		node.Language = detectLanguage(name)
	}

	return node, nil
}

// ReadFile 读取文件内容
func (pm *ProjectManager) ReadFile(relPath string) (string, error) {
	fullPath := filepath.Join(pm.projectDir, relPath)

	// 安全检查：确保路径在项目目录内
	if !strings.HasPrefix(fullPath, pm.projectDir) {
		return "", errors.New("invalid path: outside project directory")
	}

	content, err := os.ReadFile(fullPath)
	if err != nil {
		return "", errors.Wrap(err, "failed to read file: "+relPath)
	}

	return string(content), nil
}

// WriteFile 写入文件内容
func (pm *ProjectManager) WriteFile(relPath string, content string) error {
	fullPath := filepath.Join(pm.projectDir, relPath)

	// 安全检查：确保路径在项目目录内
	if !strings.HasPrefix(fullPath, pm.projectDir) {
		return errors.New("invalid path: outside project directory")
	}

	// 确保父目录存在
	dir := filepath.Dir(fullPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return errors.Wrap(err, "failed to create directory: "+dir)
	}

	if err := os.WriteFile(fullPath, []byte(content), 0644); err != nil {
		return errors.Wrap(err, "failed to write file: "+relPath)
	}

	return nil
}

// CreateFile 创建新文件
func (pm *ProjectManager) CreateFile(relPath, content string) error {
	return pm.WriteFile(relPath, content)
}

// UpdateFile 更新文件
func (pm *ProjectManager) UpdateFile(relPath, content string) error {
	fullPath := filepath.Join(pm.projectDir, relPath)

	// 安全检查
	if !strings.HasPrefix(fullPath, pm.projectDir) {
		return errors.New("invalid path: outside project directory")
	}

	// 检查文件是否存在
	if _, err := os.Stat(fullPath); os.IsNotExist(err) {
		return errors.New("file does not exist: " + relPath)
	}

	return pm.WriteFile(relPath, content)
}

// DeleteFile 删除文件
func (pm *ProjectManager) DeleteFile(relPath string) error {
	fullPath := filepath.Join(pm.projectDir, relPath)

	// 安全检查
	if !strings.HasPrefix(fullPath, pm.projectDir) {
		return errors.New("invalid path: outside project directory")
	}

	if err := os.Remove(fullPath); err != nil {
		return errors.Wrap(err, "failed to delete file: "+relPath)
	}

	return nil
}

// CreateDir 创建目录
func (pm *ProjectManager) CreateDir(relPath string) error {
	fullPath := filepath.Join(pm.projectDir, relPath)

	// 安全检查
	if !strings.HasPrefix(fullPath, pm.projectDir) {
		return errors.New("invalid path: outside project directory")
	}

	if err := os.MkdirAll(fullPath, 0755); err != nil {
		return errors.Wrap(err, "failed to create directory: "+relPath)
	}

	return nil
}

// DeleteDir 删除目录
func (pm *ProjectManager) DeleteDir(relPath string) error {
	fullPath := filepath.Join(pm.projectDir, relPath)

	// 安全检查
	if !strings.HasPrefix(fullPath, pm.projectDir) {
		return errors.New("invalid path: outside project directory")
	}

	// 不允许删除项目根目录
	if relPath == "" || relPath == "." {
		return errors.New("cannot delete project root directory")
	}

	if err := os.RemoveAll(fullPath); err != nil {
		return errors.Wrap(err, "failed to delete directory: "+relPath)
	}

	return nil
}

// Rename 重命名文件或目录
func (pm *ProjectManager) Rename(oldPath, newPath string) error {
	oldFullPath := filepath.Join(pm.projectDir, oldPath)
	newFullPath := filepath.Join(pm.projectDir, newPath)

	// 安全检查
	if !strings.HasPrefix(oldFullPath, pm.projectDir) || !strings.HasPrefix(newFullPath, pm.projectDir) {
		return errors.New("invalid path: outside project directory")
	}

	if err := os.Rename(oldFullPath, newFullPath); err != nil {
		return errors.Wrap(err, "failed to rename")
	}

	return nil
}

// Exists 检查文件或目录是否存在
func (pm *ProjectManager) Exists(relPath string) bool {
	fullPath := filepath.Join(pm.projectDir, relPath)
	_, err := os.Stat(fullPath)
	return err == nil
}

// ListFiles 列出目录下所有文件
func (pm *ProjectManager) ListFiles(relPath string) ([]string, error) {
	fullPath := filepath.Join(pm.projectDir, relPath)

	entries, err := os.ReadDir(fullPath)
	if err != nil {
		return nil, errors.Wrap(err, "failed to read directory: "+relPath)
	}

	var files []string
	for _, entry := range entries {
		files = append(files, filepath.Join(relPath, entry.Name()))
	}

	return files, nil
}

// GetFileSize 获取文件大小
func (pm *ProjectManager) GetFileSize(relPath string) (int64, error) {
	fullPath := filepath.Join(pm.projectDir, relPath)

	info, err := os.Stat(fullPath)
	if err != nil {
		return 0, errors.Wrap(err, "failed to stat file: "+relPath)
	}

	return info.Size(), nil
}

// GetProjectSize 获取项目总大小
func (pm *ProjectManager) GetProjectSize() (int64, error) {
	var totalSize int64

	err := filepath.Walk(pm.projectDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // 跳过无法访问的文件
		}
		if !info.IsDir() {
			totalSize += info.Size()
		}
		return nil
	})

	if err != nil {
		return 0, errors.Wrap(err, "failed to calculate project size")
	}

	return totalSize, nil
}

// sortFileNodes 按名称排序文件节点（目录在前，文件在后）
func sortFileNodes(nodes []*FileNode) {
	// 使用稳定的排序
	for i := 0; i < len(nodes)-1; i++ {
		for j := i + 1; j < len(nodes); j++ {
			// 目录优先
			if nodes[i].Type == FileTypeDir && nodes[j].Type == FileTypeFile {
				continue
			}
			if nodes[i].Type == FileTypeFile && nodes[j].Type == FileTypeDir {
				nodes[i], nodes[j] = nodes[j], nodes[i]
				continue
			}
			// 同类型按名称排序
			if nodes[i].Name > nodes[j].Name {
				nodes[i], nodes[j] = nodes[j], nodes[i]
			}
		}
	}
}

// detectLanguage 根据文件名检测编程语言
func detectLanguage(filename string) string {
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".js", ".jsx", ".mjs", ".cjs":
		return "javascript"
	case ".ts", ".tsx", ".mts", ".cts":
		return "typescript"
	case ".py", ".pyw":
		return "python"
	case ".go":
		return "go"
	case ".java":
		return "java"
	case ".c", ".h":
		return "c"
	case ".cpp", ".cc", ".cxx", ".hpp":
		return "cpp"
	case ".rs":
		return "rust"
	case ".rb":
		return "ruby"
	case ".php":
		return "php"
	case ".swift":
		return "swift"
	case ".kt", ".kts":
		return "kotlin"
	case ".scala":
		return "scala"
	case ".cs":
		return "csharp"
	case ".html", ".htm":
		return "html"
	case ".css", ".scss", ".sass", ".less":
		return "css"
	case ".json":
		return "json"
	case ".yaml", ".yml":
		return "yaml"
	case ".xml":
		return "xml"
	case ".md", ".markdown":
		return "markdown"
	case ".sql":
		return "sql"
	case ".sh", ".bash":
		return "bash"
	case ".dockerfile":
		return "dockerfile"
	case ".gitignore", ".env", ".env.example":
		return "dotenv"
	case ".txt":
		return "plaintext"
	default:
		return "plaintext"
	}
}
