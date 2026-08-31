package service

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"yistack/internal/model"
	"yistack/pkg/utils"
)

// buildProjectModel 根据创建请求构造项目模型。
func (s *ProjectService) buildProjectModel(req *CreateProjectRequest) *model.Project {
	projectID := "proj_" + utils.GenerateID()
	projectName := strings.TrimSpace(req.Name)
	if projectName == "" {
		projectName = deriveProjectName(req.Description, req.AppType)
	}

	project := &model.Project{
		ID:          utils.GenerateUUID(),
		UserID:      req.UserID,
		ProjectID:   projectID,
		Name:        projectName,
		Description: req.Description,
		AppType:     req.AppType,
		TechStack:   req.TechStack,
		Visibility:  "private",
		PlanID:      req.PlanID,
		PlanData:    req.PlanData,
		GitBranch:   "main",
	}

	if s.containerCfg != nil && s.containerCfg.ProjectDir != "" {
		project.DirectoryPath = filepath.Join(s.containerCfg.ProjectDir, projectID)
	}

	return project
}

// initializeProjectWorkspace 初始化用于容器挂载的项目目录。
// 新项目必须从创建阶段就是 Git 仓库，避免 Workspace 初次加载 Git 面板时误报仓库未初始化。
func (s *ProjectService) initializeProjectWorkspace(project *model.Project) {
	if project == nil || project.DirectoryPath == "" {
		return
	}

	safeProjectDir, err := secureProjectHostDirectory(currentProjectRootDir(), project.ProjectID, project.DirectoryPath)
	if err != nil {
		log.Printf("Warning: refuse to create unsafe project directory for %s: %v", project.ProjectID, err)
		return
	}

	if err := os.MkdirAll(safeProjectDir, 0755); err != nil {
		log.Printf("Warning: failed to create project directory: %v", err)
		return
	}
	if err := initializeProjectGitRepository(safeProjectDir); err != nil {
		log.Printf("Warning: failed to initialize project git repository for %s: %v", project.ProjectID, err)
	}
}

func initializeProjectGitRepository(projectDir string) error {
	gitDir := filepath.Join(projectDir, ".git")
	if _, err := os.Stat(gitDir); err == nil {
		return nil
	}
	if _, err := exec.LookPath("git"); err != nil {
		return err
	}
	gitignorePath := filepath.Join(projectDir, ".gitignore")
	if _, err := os.Stat(gitignorePath); os.IsNotExist(err) {
		if err := os.WriteFile(gitignorePath, []byte(defaultProjectGitIgnoreContent()), 0o644); err != nil {
			return err
		}
	}
	if err := runProjectGitCommand(projectDir, "init"); err != nil {
		return err
	}
	return runProjectGitCommand(projectDir, "symbolic-ref", "HEAD", "refs/heads/main")
}

func runProjectGitCommand(projectDir string, args ...string) error {
	cmd := exec.Command("git", args...)
	cmd.Dir = projectDir
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("git %s failed: %w: %s", strings.Join(args, " "), err, strings.TrimSpace(string(output)))
	}
	return nil
}

func defaultProjectGitIgnoreContent() string {
	return strings.TrimSpace(`# Dependencies
node_modules/
__pycache__/
*.pyc
.env

# Build output
dist/
build/
.next/
.nuxt/

# IDE
.vscode/
.idea/

# Logs
*.log
npm-debug.log*

# OS
.DS_Store
Thumbs.db
`) + "\n"
}

// reloadProjectAfterCreate 优先返回数据库中的最新项目快照。
func (s *ProjectService) reloadProjectAfterCreate(ctx context.Context, fallback *model.Project) *model.Project {
	if fallback == nil {
		return nil
	}
	refreshedProject, err := s.projectRepo.FindByProjectID(ctx, fallback.ProjectID)
	if err == nil && refreshedProject != nil {
		return refreshedProject
	}
	return fallback
}
