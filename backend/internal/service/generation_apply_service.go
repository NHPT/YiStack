package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"strings"
	"time"

	"yistack/internal/model"
	"yistack/internal/prompt"
	"yistack/pkg/container"

	"gorm.io/gorm"
)

type generationResult struct {
	SchemaVersion     string                    `json:"schema_version"`
	Operations        []GenerationFileOperation `json:"operations"`
	Files             []FileToGenerate          `json:"-"`
	Message           string                    `json:"message"`
	Commands          []string                  `json:"commands"`
	GitCommitCreated  bool                      `json:"-"`
	ProjectValidation *ProjectValidationResult  `json:"-"`
	Repair            *GenerationRepairEvidence `json:"-"`
	BrowserAcceptance *BrowserAcceptanceResult  `json:"-"`
}

type generationResultWire struct {
	SchemaVersion *string                        `json:"schema_version"`
	Operations    *[]generationFileOperationWire `json:"operations"`
	Message       *string                        `json:"message"`
	Commands      *[]string                      `json:"commands"`
}

func generationFileStepKind(pathExists bool) string {
	if pathExists {
		return "write_file"
	}
	return "create_file"
}

func generationFileStepTitle(pathExists bool) string {
	if pathExists {
		return "更新文件"
	}
	return "创建文件"
}

// loadGenerationProject 读取生成前所需的项目和上下文。
func (s *GeneratorService) loadGenerationProject(ctx context.Context, projectID string) (*model.Project, string, string, error) {
	if s.projectRepo == nil || projectID == "" {
		return nil, "", "", nil
	}

	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil || project == nil {
		return nil, "", "", nil
	}

	if projectNeedsRuntime(project.AppType) && s.containerMgr != nil {
		if _, _, runtimeErr := ensureProjectRuntimeBaseContainer(ctx, project, s.projectRepo, s.containerMgr, s.containerCfg, s.getImageForRuntimeProfile); runtimeErr == nil {
			projectContext, contextErr := s.loadProjectPromptContext(ctx, project)
			return project, project.DirectoryPath, projectContext, contextErr
		}
	}

	return project, project.DirectoryPath, "", nil
}

// PersistProjectArtifact 将结构化产物写入当前项目工作区。
func (s *GeneratorService) PersistProjectArtifact(ctx context.Context, projectID, filePath, content string) error {
	if s == nil {
		return errors.New("generator service not available")
	}
	if s.projectRepo == nil {
		return errors.New("project repository not available")
	}
	if strings.TrimSpace(projectID) == "" || strings.TrimSpace(filePath) == "" || strings.TrimSpace(content) == "" {
		return nil
	}

	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return fmt.Errorf("failed to load project for artifact persistence: %w", err)
	}
	if project == nil {
		return fmt.Errorf("project not found for artifact persistence")
	}
	persistedRecord, err := s.persistProjectArtifactRecord(ctx, projectID, filePath, content)
	if err != nil {
		return err
	}
	if !projectNeedsRuntime(project.AppType) {
		return nil
	}
	if s.containerMgr == nil {
		if persistedRecord {
			return nil
		}
		s.persistGenerationContainerUnavailable(ctx, project)
		return errors.New("container manager not available")
	}
	if _, _, runtimeErr := ensureProjectRuntimeBaseContainer(ctx, project, s.projectRepo, s.containerMgr, s.containerCfg, s.getImageForRuntimeProfile); runtimeErr != nil {
		if persistedRecord {
			return nil
		}
		s.persistGenerationContainerUnavailable(ctx, project)
		return runtimeErr
	}
	if err := writeFileInContainer(ctx, s.containerMgr, projectID, filePath, content); err != nil {
		if persistedRecord {
			return nil
		}
		return err
	}
	refreshProjectFileTree(ctx, projectID, s.containerMgr, s.projectRepo)
	return nil
}

// LoadProjectArtifact 读取当前项目工作区内的结构化产物。
func (s *GeneratorService) LoadProjectArtifact(ctx context.Context, projectID, filePath string) (string, bool, error) {
	if s == nil {
		return "", false, errors.New("generator service not available")
	}
	if s.projectRepo == nil {
		return "", false, errors.New("project repository not available")
	}
	if strings.TrimSpace(projectID) == "" || strings.TrimSpace(filePath) == "" {
		return "", false, nil
	}

	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return "", false, fmt.Errorf("failed to load project for artifact read: %w", err)
	}
	if project == nil {
		return "", false, fmt.Errorf("project not found for artifact read")
	}
	if content, found, recordErr := s.loadProjectArtifactRecord(ctx, projectID, filePath); recordErr != nil {
		return "", false, recordErr
	} else if found {
		return content, true, nil
	}
	if !projectNeedsRuntime(project.AppType) {
		return "", false, nil
	}
	if s.containerMgr == nil {
		s.persistGenerationContainerUnavailable(ctx, project)
		return "", false, errors.New("container manager not available")
	}
	if _, _, runtimeErr := ensureProjectRuntimeBaseContainer(ctx, project, s.projectRepo, s.containerMgr, s.containerCfg, s.getImageForRuntimeProfile); runtimeErr != nil {
		s.persistGenerationContainerUnavailable(ctx, project)
		return "", false, runtimeErr
	}

	exists, err := projectPathExistsInContainer(ctx, s.containerMgr, projectID, filePath)
	if err != nil || !exists {
		return "", false, err
	}
	content, err := readProjectFileInContainer(ctx, s.containerMgr, projectID, filePath)
	if err != nil {
		return "", true, err
	}
	return content, true, nil
}

func (s *GeneratorService) persistProjectArtifactRecord(ctx context.Context, projectID, filePath, content string) (bool, error) {
	if s == nil || s.fileRepo == nil {
		return false, nil
	}
	sum := sha256.Sum256([]byte(content))
	contentHash := hex.EncodeToString(sum[:])
	existing, err := s.fileRepo.FindByPath(ctx, projectID, filePath)
	if err == nil && existing != nil {
		existing.Content = content
		existing.ContentHash = contentHash
		existing.Size = len([]byte(content))
		existing.FileType = "file"
		return true, s.fileRepo.Update(ctx, existing)
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return false, fmt.Errorf("failed to load project artifact record: %w", err)
	}
	return true, s.fileRepo.Create(ctx, &model.ProjectFile{
		ProjectID:   projectID,
		Path:        filePath,
		Content:     content,
		ContentHash: contentHash,
		FileType:    "file",
		Size:        len([]byte(content)),
	})
}

func (s *GeneratorService) loadProjectArtifactRecord(ctx context.Context, projectID, filePath string) (string, bool, error) {
	if s == nil || s.fileRepo == nil {
		return "", false, nil
	}
	file, err := s.fileRepo.FindByPath(ctx, projectID, filePath)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", false, nil
		}
		return "", false, fmt.Errorf("failed to load project artifact record: %w", err)
	}
	if file == nil {
		return "", false, nil
	}
	return file.Content, true, nil
}

// ensureRuntimeForGeneration 确保项目容器与声明的运行时依赖均已就绪。
// 为保护宿主机，生成流程不允许在容器不可用时降级到宿主机执行。
func (s *GeneratorService) ensureRuntimeForGeneration(ctx context.Context, project *model.Project, handler StreamEventHandler) error {
	if project == nil {
		return nil
	}
	if !projectNeedsRuntime(project.AppType) {
		return nil
	}
	if s.containerMgr == nil {
		statusPayload := s.persistGenerationContainerUnavailable(ctx, project)
		err := errors.New("container manager not available")
		_ = handler(StreamEventError, mergeGenerationErrorPayload(err, statusPayload))
		return err
	}

	info, spec, err := ensureProjectRuntimeBaseContainer(ctx, project, s.projectRepo, s.containerMgr, s.containerCfg, s.getImageForRuntimeProfile)
	if err != nil {
		statusPayload := s.persistGenerationContainerUnavailable(ctx, project)
		_ = handler(StreamEventError, mergeGenerationErrorPayload(err, statusPayload))
		return err
	}
	project.ContainerStatus = string(info.Status)

	if err := prepareRuntimeEnvironment(
		safeContext(ctx),
		s.containerMgr,
		project,
		spec,
		runtimeAPTMirrors(s.containerCfg),
	); err != nil {
		runtimeErr := fmt.Errorf("runtime environment is not ready: %w", err)
		_ = handler(StreamEventError, map[string]interface{}{
			"error":   runtimeErr.Error(),
			"message": "开发环境尚未准备完成，请先等待运行时准备就绪",
		})
		return runtimeErr
	}
	return nil
}

func (s *GeneratorService) persistGenerationContainerUnavailable(ctx context.Context, project *model.Project) map[string]interface{} {
	status := ProjectRuntimeStatus{
		Status:                     "failed",
		ContainerStatus:            "unavailable",
		Phase:                      "generation",
		Message:                    "生成应用无法连接容器管理器",
		Error:                      "container manager not available",
		ContainerStatusPersistence: "updated",
		CompletedAt:                runtimeStatusNow(),
	}
	if project != nil {
		status.ProjectID = project.ProjectID
	}
	payload := map[string]interface{}{
		"container_status":             "unavailable",
		"container_status_persistence": "updated",
	}
	if s == nil || s.projectRepo == nil || project == nil || strings.TrimSpace(project.ProjectID) == "" {
		status.ContainerStatusPersistence = "failed"
		status.ContainerStatusPersistenceError = "project repository or project id not available"
		payload["container_status_persistence"] = "failed"
		payload["container_status_persistence_error"] = "project repository or project id not available"
		payload["runtime_status"] = status
		return payload
	}
	if err := s.projectRepo.UpdateContainerStatus(safeContext(ctx), project.ProjectID, "unavailable"); err != nil {
		log.Printf("Warning: failed to persist generation unavailable container status for project %s: %v", project.ProjectID, err)
		status.ContainerStatusPersistence = "failed"
		status.ContainerStatusPersistenceError = err.Error()
		payload["container_status_persistence"] = "failed"
		payload["container_status_persistence_error"] = err.Error()
	}
	status = setProjectRuntimeStatus(project.DirectoryPath, status)
	payload["runtime_status"] = status
	if status.PersistenceStatus != "" {
		payload["runtime_status_persistence"] = status.PersistenceStatus
	}
	if status.PersistenceError != "" {
		payload["runtime_status_persistence_error"] = status.PersistenceError
	}
	return payload
}

func mergeGenerationErrorPayload(err error, extra map[string]interface{}) map[string]interface{} {
	payload := map[string]interface{}{}
	if err != nil {
		payload["error"] = err.Error()
	}
	for key, value := range extra {
		payload[key] = value
	}
	return payload
}

func (s *GeneratorService) recordGenerationCollaborationEvents(
	ctx context.Context,
	req *GenerateRequest,
	project *model.Project,
	operations []GenerationFileOperation,
) error {
	if s == nil || s.collaborationRepo == nil || req == nil || project == nil {
		return nil
	}
	role := ProjectMemberRoleEditor
	if strings.TrimSpace(project.UserID) == strings.TrimSpace(req.UserID) {
		role = ProjectMemberRoleOwner
	}
	for _, operation := range operations {
		eventType := ProjectCollaborationEventFileSaved
		revision := operation.ResultHash
		if operation.Operation == GenerationFileOperationDelete {
			eventType = ProjectCollaborationEventTreeChanged
			revision = ""
		}
		event := newProjectCollaborationEvent(
			req.ProjectID,
			req.UserID,
			"",
			eventType,
			operation.Path,
			revision,
			map[string]interface{}{
				"role":      role,
				"source":    "generation",
				"operation": operation.Operation,
			},
			time.Now().UTC(),
		)
		if err := s.collaborationRepo.AppendCollaborationEvent(ctx, event); err != nil {
			return fmt.Errorf("record generation collaboration event for %s: %w", operation.Path, err)
		}
	}
	return nil
}

// applyGenerationArtifacts 负责把生成结果真正落到文件系统、容器、文档和 Git。
func (s *GeneratorService) applyGenerationArtifacts(ctx context.Context, req *GenerateRequest, project *model.Project, result *generationResult, handler StreamEventHandler) error {
	if result == nil {
		return nil
	}
	if len(result.Operations) > 0 {
		workspace := s.activeGenerationFileWorkspace()
		if workspace == nil {
			statusPayload := s.persistGenerationContainerUnavailable(ctx, project)
			err := errors.New("container manager not available")
			_ = handler(StreamEventError, mergeGenerationErrorPayload(err, statusPayload))
			return err
		}
		operations, files, err := applyGenerationFileOperations(
			ctx, workspace, req.ProjectID,
			result.Operations, nil, handler,
		)
		if err != nil {
			return err
		}
		result.Operations = operations
		result.Files = files
		if eventErr := s.recordGenerationCollaborationEvents(ctx, req, project, operations); eventErr != nil {
			log.Printf("Warning: failed to record generation collaboration events: %v", eventErr)
			_ = handler(StreamEventProgress, map[string]interface{}{
				"progress": 70,
				"message":  "文件已写入，但共享工作区事件同步失败；协作者需手动刷新。",
				"warning":  eventErr.Error(),
			})
		}
		if s.containerMgr != nil {
			refreshProjectFileTree(ctx, req.ProjectID, s.containerMgr, s.projectRepo)
		}
	}
	_ = handler(StreamEventProgress, map[string]interface{}{
		"progress": 72,
		"message":  "文件已写入，正在安装依赖并准备预览服务...",
	})

	commandErr := s.runGeneratedCommands(ctx, req.ProjectID, project, result.Commands, handler)
	if commandErr != nil && !isRepairableGenerationCommandFailure(commandErr) {
		return commandErr
	}
	_ = handler(StreamEventProgress, map[string]interface{}{
		"progress": 86,
		"message":  "正在执行项目级 Build/Test/Lint Gate...",
	})
	if err := s.validateAndRepairGeneratedProject(ctx, req, project, result, commandErr, handler); err != nil {
		return err
	}

	return s.finalizeGeneratedProject(ctx, req, project, result, handler)
}

func (s *GeneratorService) validateAndRepairGeneratedProject(
	ctx context.Context,
	req *GenerateRequest,
	project *model.Project,
	result *generationResult,
	_ error,
	handler StreamEventHandler,
) error {
	validationResult, validationErr := s.validateGeneratedProject(ctx, req.ProjectID, project, handler)
	result.ProjectValidation = validationResult
	if validationErr != nil {
		return s.repairGeneratedProject(ctx, req, project, result, validationResult, validationErr, handler)
	}
	// Passing the full validation gate proves a repairable command failure was recovered.
	return nil
}

// writeGeneratedFiles 将生成文件写入容器工作目录。
// 容器内 /workspace 绑定项目目录，因此文件会通过容器操作落地到宿主机项目目录。
func (s *GeneratorService) writeGeneratedFiles(ctx context.Context, projectID string, project *model.Project, files []FileToGenerate, handler StreamEventHandler) error {
	if projectID == "" {
		return nil
	}
	if s.containerMgr == nil {
		statusPayload := s.persistGenerationContainerUnavailable(ctx, project)
		err := errors.New("container manager not available")
		_ = handler(StreamEventError, mergeGenerationErrorPayload(err, statusPayload))
		return err
	}

	for _, f := range files {
		if err := ctx.Err(); err != nil {
			return err
		}
		pathExists, statErr := projectPathExistsInContainer(ctx, s.containerMgr, projectID, f.Path)
		if statErr != nil {
			return statErr
		}
		stepKind := generationFileStepKind(pathExists)
		stepTitle := generationFileStepTitle(pathExists)
		_ = emitWorkflowStep(handler, "write:"+f.Path, stepKind, stepTitle, f.Path, "running", map[string]interface{}{
			"path":    f.Path,
			"content": f.Content,
		})
		log.Printf("Writing generated file for project %s: %s", projectID, f.Path)
		if err := writeFileInContainer(ctx, s.containerMgr, projectID, f.Path, f.Content); err != nil {
			_ = emitWorkflowStep(handler, "write:"+f.Path, stepKind, stepTitle, err.Error(), "failed", map[string]interface{}{
				"path": f.Path,
			})
			return fmt.Errorf("write file %s in container: %w", f.Path, err)
		}
		_ = emitWorkflowStep(handler, "write:"+f.Path, stepKind, stepTitle, "文件已同步到项目工作区。", "done", map[string]interface{}{
			"path":    f.Path,
			"content": f.Content,
		})
	}
	refreshProjectFileTree(ctx, projectID, s.containerMgr, s.projectRepo)

	return nil
}

// runGeneratedCommands 在项目容器中执行模型返回的推荐命令。
func (s *GeneratorService) runGeneratedCommands(ctx context.Context, projectID string, project *model.Project, commands []string, handler StreamEventHandler) error {
	if project == nil || projectID == "" || len(commands) == 0 {
		return nil
	}
	commandExecutor := s.commandExecutor
	if commandExecutor == nil && s.containerMgr != nil {
		commandExecutor = s.containerMgr
	}
	if commandExecutor == nil {
		statusPayload := s.persistGenerationContainerUnavailable(ctx, project)
		err := errors.New("container manager not available")
		_ = handler(StreamEventError, mergeGenerationErrorPayload(err, statusPayload))
		return err
	}

	_ = handler(StreamEventProgress, map[string]interface{}{
		"progress": 80,
		"message":  "正在容器中执行安装命令...",
	})

	for _, cmd := range commands {
		if err := ctx.Err(); err != nil {
			return err
		}
		if policyErr := validateGeneratedCommandPolicy(cmd); policyErr != nil {
			failure := newGenerationCommandFailure(cmd, nil, policyErr.Error(), policyErr)
			failure.Check = "policy"
			_ = emitWorkflowStep(handler, "cmd:"+cmd, "run_command", "执行推荐命令", failure.Error(), "failed", map[string]interface{}{
				"command":     cmd,
				"reason_code": failure.Code,
			})
			return failure
		}
		_ = emitWorkflowStep(handler, "cmd:"+cmd, "run_command", "执行推荐命令", cmd, "running", nil)
		executionPlan := generatedCommandExecutionPlan(cmd)
		outputs := make([]string, 0, len(executionPlan))
		for _, args := range executionPlan {
			opts := &container.RunOptions{
				ProjectID: projectID,
				Command:   strings.Join(args, " "),
				Args:      args,
				WorkDir:   "/workspace",
				Timeout:   300,
			}
			result, err := commandExecutor.ExecuteInContainer(ctx, opts)
			if err != nil {
				if errors.Is(err, context.Canceled) || errors.Is(ctx.Err(), context.Canceled) {
					return context.Canceled
				}
				log.Printf("Warning: command execution failed: %v", err)
				failure := newGenerationCommandFailure(cmd, nil, err.Error(), err)
				_ = emitWorkflowStep(handler, "cmd:"+cmd, "run_command", "执行推荐命令", failure.Error(), "failed", map[string]interface{}{
					"command":        cmd,
					"execution_args": args,
					"reason_code":    failure.Code,
				})
				return failure
			}
			if result == nil {
				failure := newGenerationCommandFailure(cmd, nil, "container command returned no result", nil)
				_ = emitWorkflowStep(handler, "cmd:"+cmd, "run_command", "执行推荐命令", failure.Error(), "failed", map[string]interface{}{
					"command":        cmd,
					"execution_args": args,
					"reason_code":    failure.Code,
				})
				return failure
			}

			log.Printf("Command executed: %s, exit code: %d", opts.Command, result.ExitCode)
			output := generatedCommandOutput(result)
			if result.ExitCode != 0 {
				exitCode := result.ExitCode
				failure := newGenerationCommandFailure(cmd, &exitCode, output, nil)
				_ = emitWorkflowStep(handler, "cmd:"+cmd, "run_command", "执行推荐命令", failure.Error(), "failed", map[string]interface{}{
					"command":        cmd,
					"execution_args": args,
					"exitCode":       result.ExitCode,
					"reason_code":    failure.Code,
				})
				return failure
			}
			if output != "" {
				outputs = append(outputs, output)
			}
		}
		_ = emitWorkflowStep(handler, "cmd:"+cmd, "run_command", "执行推荐命令", strings.Join(outputs, "\n"), "done", map[string]interface{}{
			"command":  cmd,
			"exitCode": 0,
		})
	}
	return nil
}

func generatedCommandOutput(result *container.ExecResult) string {
	if result == nil {
		return ""
	}
	output := strings.TrimSpace(result.Stdout)
	if result.ExitCode != 0 && strings.TrimSpace(result.Stderr) != "" {
		output = strings.TrimSpace(result.Stderr)
	}
	if output == "" {
		output = strings.TrimSpace(result.Stderr)
	}
	const outputLimit = 4096
	if len(output) > outputLimit {
		const retainedEdge = outputLimit / 2
		return output[:retainedEdge] +
			"\n... output truncated ...\n" +
			output[len(output)-retainedEdge:]
	}
	return output
}

// finalizeGeneratedProject 在容器内刷新项目上下文文档与 Git 提交。
func (s *GeneratorService) finalizeGeneratedProject(ctx context.Context, req *GenerateRequest, project *model.Project, result *generationResult, handler StreamEventHandler) error {
	if project == nil {
		return nil
	}

	if s.containerMgr == nil {
		statusPayload := s.persistGenerationContainerUnavailable(ctx, project)
		err := errors.New("container manager not available")
		_ = handler(StreamEventError, mergeGenerationErrorPayload(err, statusPayload))
		return err
	}

	files := []FileToGenerate{
		{Path: projectAgentsPath, Content: renderProjectTemplateWithConfig(ctx, s.systemConfigSvc, "templates/project_docs/AGENTS.md.tmpl", buildProjectDocTemplateData(project, req.Prompt, result.Files, result.Commands))},
		{Path: projectContextPath, Content: buildProjectContextContent(project, req.Prompt, result.Files, result.Commands)},
		{Path: projectRequirementsPath, Content: renderProjectTemplateWithConfig(ctx, s.systemConfigSvc, "templates/project_docs/REQUIREMENTS.md.tmpl", buildProjectDocTemplateData(project, "", nil, nil))},
		{Path: projectDesignPath, Content: renderProjectTemplateWithConfig(ctx, s.systemConfigSvc, "templates/project_docs/DESIGN.md.tmpl", buildProjectDocTemplateData(project, "", result.Files, nil))},
		{Path: projectRunbookPath, Content: renderProjectTemplateWithConfig(ctx, s.systemConfigSvc, "templates/project_docs/RUNBOOK.md.tmpl", buildProjectDocTemplateData(project, req.Prompt, nil, result.Commands))},
	}
	previousManifest := ""
	manifestExists, manifestStatErr := projectPathExistsInContainer(ctx, s.containerMgr, req.ProjectID, projectDocsManifestPath)
	if manifestStatErr != nil {
		return manifestStatErr
	}
	if manifestExists {
		content, readErr := readProjectFileInContainer(ctx, s.containerMgr, req.ProjectID, projectDocsManifestPath)
		if readErr != nil {
			return readErr
		}
		previousManifest = content
	}
	if manifestContent := buildProjectDocsManifestContent(project, req.Prompt, files, result.Files, result.Commands, previousManifest, time.Now().UTC()); strings.TrimSpace(manifestContent) != "" {
		files = append(files, FileToGenerate{Path: projectDocsManifestPath, Content: manifestContent})
	}

	for _, file := range files {
		if strings.TrimSpace(file.Content) == "" {
			continue
		}
		pathExists, statErr := projectPathExistsInContainer(ctx, s.containerMgr, req.ProjectID, file.Path)
		if statErr != nil {
			return statErr
		}
		stepKind := generationFileStepKind(pathExists)
		stepTitle := generationFileStepTitle(pathExists)
		_ = emitWorkflowStep(handler, "write:"+file.Path, stepKind, stepTitle, file.Path, "running", map[string]interface{}{
			"path":    file.Path,
			"content": file.Content,
		})
		if err := writeFileInContainer(ctx, s.containerMgr, req.ProjectID, file.Path, file.Content); err != nil {
			_ = emitWorkflowStep(handler, "write:"+file.Path, stepKind, stepTitle, err.Error(), "failed", map[string]interface{}{
				"path": file.Path,
			})
			return err
		}
		_ = emitWorkflowStep(handler, "write:"+file.Path, stepKind, stepTitle, "文件已同步到项目工作区。", "done", map[string]interface{}{
			"path":    file.Path,
			"content": file.Content,
		})
	}
	refreshProjectFileTree(ctx, req.ProjectID, s.containerMgr, s.projectRepo)

	if projectNeedsRuntime(project.AppType) {
		_ = handler(StreamEventProgress, map[string]interface{}{
			"progress": 92,
			"message":  "预览服务启动中...",
		})
		_ = emitWorkflowStep(handler, "preview-server", "run_command", "启动预览服务", "正在启动项目预览服务。", "running", nil)
		runtimeStatus, previewErr := s.startGeneratedProjectPreview(ctx, project)
		if previewErr != nil {
			_ = emitWorkflowStep(handler, "preview-server", "run_command", "启动预览服务", previewErr.Error(), "failed", map[string]interface{}{
				"runtime_status": runtimeStatus,
			})
			return fmt.Errorf("start preview server: %w", previewErr)
		}
		_ = emitWorkflowStep(handler, "preview-server", "run_command", "启动预览服务", "预览服务已启动，可在 Preview 面板打开。", "done", map[string]interface{}{
			"runtime_status": runtimeStatus,
			"previewUrl":     runtimeStatus.PreviewURL,
		})
		browserAcceptance, acceptanceErr := s.runGeneratedProjectBrowserAcceptance(ctx, req.ProjectID, runtimeStatus, req.BrowserAcceptance, handler)
		result.BrowserAcceptance = browserAcceptance
		if acceptanceErr != nil {
			return newGenerationBrowserAcceptanceFailure(browserAcceptance, acceptanceErr)
		}
	}

	_ = emitWorkflowStep(handler, "git-commit", "run_command", "生成版本快照", "正在检查本次生成是否产生可提交的代码变更。", "running", nil)
	commitCreated, commitSnapshot, err := createProjectGitCommitInContainer(ctx, s.containerMgr, req.ProjectID, buildGitCommitMessage(req.Prompt, result.Message))
	if err != nil {
		log.Printf("Warning: failed to create git commit after generation: %v", err)
		_ = emitWorkflowStep(handler, "git-commit", "run_command", "生成版本快照", err.Error(), "failed", nil)
	} else {
		if commitCreated {
			result.GitCommitCreated = true
			commitDetail := "Git 提交已创建，可在版本历史中查看。"
			if commitSnapshot == nil {
				commitDetail = "Git 提交已创建，但提交记录元数据暂不可用。"
			} else if err := persistProjectGitCommitSnapshot(ctx, s.commitRepo, project, commitSnapshot); err != nil {
				log.Printf("Warning: failed to persist git commit after generation: %v", err)
				commitDetail = "Git 提交已创建，但提交记录写入失败。"
			}
			_ = emitWorkflowStep(handler, "git-commit", "run_command", "生成版本快照", commitDetail, "done", nil)
		} else {
			result.GitCommitCreated = false
			_ = emitWorkflowStep(handler, "git-commit", "run_command", "生成版本快照", "本次未产生文件变更，未创建新的 Git 提交。", "done", nil)
		}
	}
	return nil
}

func (s *GeneratorService) startGeneratedProjectPreview(ctx context.Context, project *model.Project) (*ProjectRuntimeStatus, error) {
	if s == nil {
		return nil, errors.New("generator service not available")
	}
	if project == nil {
		return nil, errors.New("project is required")
	}
	if s.containerMgr == nil {
		statusPayload := s.persistGenerationContainerUnavailable(ctx, project)
		status, _ := statusPayload["runtime_status"].(ProjectRuntimeStatus)
		return &status, errors.New("container manager not available")
	}

	baseImage := normalizeRuntimeImage(project.ContainerImage)
	if strings.TrimSpace(baseImage) == "" {
		baseImage = normalizeRuntimeImage(s.getImageForRuntimeProfile(projectRuntimeProfile(project)))
	}
	spec := projectRuntimeEnvironmentSpec(project, baseImage, inferRuntimeImageStrategy(projectRuntimeProfile(project), baseImage, s.containerCfg))
	containerStatus := project.ContainerStatus
	if strings.TrimSpace(containerStatus) == "" {
		containerStatus = "running"
	}

	preparing := ProjectRuntimeStatus{
		ProjectID:       project.ProjectID,
		Status:          "preparing",
		ContainerStatus: containerStatus,
		Phase:           "preview",
		Message:         "正在启动预览服务",
		InternalPort:    runtimeApplicationPort(spec),
		PreviewURL:      buildProjectPreviewURL(project.ProjectID, s.containerCfg),
		SpecHash:        runtimeSpecHash(spec),
		StartedAt:       runtimeStatusNow(),
	}
	_ = writeProjectRuntimeStatus(project.DirectoryPath, &preparing)

	if err := ensureProjectPreviewServer(ctx, s.containerMgr, project, spec, true); err != nil {
		failed := ProjectRuntimeStatus{
			ProjectID:       project.ProjectID,
			Status:          "failed",
			ContainerStatus: containerStatus,
			Phase:           "preview",
			Message:         "预览服务启动失败",
			Error:           err.Error(),
			InternalPort:    runtimeApplicationPort(spec),
			PreviewURL:      buildProjectPreviewURL(project.ProjectID, s.containerCfg),
			SpecHash:        runtimeSpecHash(spec),
			StartedAt:       preparing.StartedAt,
			CompletedAt:     runtimeStatusNow(),
		}
		_ = writeProjectRuntimeStatus(project.DirectoryPath, &failed)
		return &failed, err
	}

	ready := ProjectRuntimeStatus{
		ProjectID:       project.ProjectID,
		Status:          "ready",
		ContainerStatus: containerStatus,
		Phase:           "ready",
		Message:         "开发环境和预览服务已就绪",
		InternalPort:    runtimeApplicationPort(spec),
		PreviewURL:      buildProjectPreviewURL(project.ProjectID, s.containerCfg),
		SpecHash:        runtimeSpecHash(spec),
		StartedAt:       preparing.StartedAt,
		CompletedAt:     runtimeStatusNow(),
	}
	_ = writeProjectRuntimeStatus(project.DirectoryPath, &ready)
	return &ready, nil
}

// persistAssistantGenerationMessage 记录生成后的 assistant 消息。
func (s *GeneratorService) persistAssistantGenerationMessage(ctx context.Context, req *GenerateRequest, modelName string, result generationResult, rawContent string) {
	if s.chatRepo == nil || req.ProjectID == "" {
		return
	}

	assistantContent := strings.TrimSpace(result.Message)
	if assistantContent == "" {
		assistantContent = strings.TrimSpace(rawContent)
	}
	if assistantContent == "" {
		return
	}

	_ = s.chatRepo.Create(ctx, &model.ChatMessage{
		ProjectID:     req.ProjectID,
		UserID:        req.UserID,
		Role:          "assistant",
		Content:       assistantContent,
		VisualContext: marshalVisualContextSnapshot(req.VisualContext),
		Model:         modelName,
	})
}

func (s *GeneratorService) persistAssistantDraftMessage(req *GenerateRequest, modelName, prefix, content string) {
	if s.chatRepo == nil || req == nil || req.ProjectID == "" {
		return
	}

	draftContent := strings.TrimSpace(content)
	if prefix = strings.TrimSpace(prefix); prefix != "" {
		if draftContent != "" {
			draftContent = prefix + "\n\n" + draftContent
		} else {
			draftContent = prefix
		}
	}
	if draftContent == "" {
		return
	}

	persistCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_ = s.chatRepo.Create(persistCtx, &model.ChatMessage{
		ProjectID:     req.ProjectID,
		UserID:        req.UserID,
		Role:          "assistant",
		Content:       draftContent,
		VisualContext: marshalVisualContextSnapshot(req.VisualContext),
		Model:         modelName,
	})
}

// failGeneration 统一处理生成失败时的消息与状态回滚。
func (s *GeneratorService) failGeneration(ctx context.Context, req *GenerateRequest, modelName string, err error, handler StreamEventHandler) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, context.Canceled) {
		_ = handler(StreamEventError, map[string]interface{}{
			"error":   err.Error(),
			"message": "生成已停止",
		})
		return err
	}
	if s.chatRepo != nil && req.ProjectID != "" {
		_ = s.chatRepo.Create(ctx, &model.ChatMessage{
			ProjectID:     req.ProjectID,
			UserID:        req.UserID,
			Role:          "assistant",
			Content:       "生成失败: " + err.Error(),
			VisualContext: marshalVisualContextSnapshot(req.VisualContext),
			Model:         modelName,
		})
	}
	_ = handler(StreamEventError, map[string]interface{}{"error": err.Error()})
	return err
}

// normalizeDonePayload 统一拼装生成完成事件负载。
func normalizeDonePayload(rawContent, provider string, result generationResult, guidance responseGuidance) map[string]interface{} {
	return map[string]interface{}{
		"progress":           100,
		"message":            "代码生成完成！",
		"content":            rawContent,
		"provider":           provider,
		"schemaVersion":      result.SchemaVersion,
		"operations":         result.Operations,
		"files":              result.Files,
		"commands":           result.Commands,
		"projectValidation":  result.ProjectValidation,
		"repair":             result.Repair,
		"browserAcceptance":  result.BrowserAcceptance,
		"genMessage":         result.Message,
		"gitCommitCreated":   result.GitCommitCreated,
		"suggestedQuestions": guidance.SuggestedQuestions,
		"suggestedActions":   guidance.SuggestedActions,
	}
}

// logGenerationParseFailure 统一记录结果解析失败日志。
func logGenerationParseFailure(err error) {
	if err != nil {
		log.Printf("Warning: failed to parse generated files: %v", err)
	}
}

// decodeGenerationResult strictly validates the versioned generation result contract.
func decodeGenerationResult(rawContent string) (generationResult, error) {
	rawContent = strings.TrimSpace(rawContent)
	if rawContent == "" {
		err := errors.New("generation result is empty")
		logGenerationParseFailure(err)
		return generationResult{}, newGenerationSchemaFailure(err)
	}

	decoder := json.NewDecoder(strings.NewReader(rawContent))
	decoder.DisallowUnknownFields()
	var wire generationResultWire
	if err := decoder.Decode(&wire); err != nil {
		logGenerationParseFailure(err)
		return generationResult{}, newGenerationSchemaFailure(fmt.Errorf("decode generation result: %w", err))
	}
	if err := ensureGenerationResultJSONEOF(decoder); err != nil {
		logGenerationParseFailure(err)
		return generationResult{}, newGenerationSchemaFailure(err)
	}

	result, err := validateGenerationResultWire(wire)
	if err != nil {
		logGenerationParseFailure(err)
		return generationResult{}, newGenerationSchemaFailure(err)
	}
	return result, nil
}

func ensureGenerationResultJSONEOF(decoder *json.Decoder) error {
	var trailing any
	if err := decoder.Decode(&trailing); errors.Is(err, io.EOF) {
		return nil
	} else if err != nil {
		return fmt.Errorf("decode trailing generation result: %w", err)
	}
	return errors.New("generation result contains multiple JSON values")
}

func validateGenerationResultWire(wire generationResultWire) (generationResult, error) {
	if wire.SchemaVersion == nil || strings.TrimSpace(*wire.SchemaVersion) != prompt.GenerationResultSchemaVersion {
		return generationResult{}, fmt.Errorf("schema_version must be %q", prompt.GenerationResultSchemaVersion)
	}
	if wire.Operations == nil {
		return generationResult{}, errors.New("operations must be an array")
	}
	if wire.Message == nil || strings.TrimSpace(*wire.Message) == "" {
		return generationResult{}, errors.New("message must be a non-empty string")
	}
	if wire.Commands == nil {
		return generationResult{}, errors.New("commands must be an array")
	}

	operations, err := validateGenerationFileOperations(*wire.Operations)
	if err != nil {
		return generationResult{}, err
	}

	commands := make([]string, 0, len(*wire.Commands))
	seenCommands := make(map[string]struct{}, len(*wire.Commands))
	for index, command := range *wire.Commands {
		command = strings.TrimSpace(command)
		if command == "" {
			return generationResult{}, fmt.Errorf("commands[%d] must be non-empty", index)
		}
		if _, exists := seenCommands[command]; exists {
			return generationResult{}, fmt.Errorf("duplicate command %q", command)
		}
		seenCommands[command] = struct{}{}
		commands = append(commands, command)
	}

	return generationResult{
		SchemaVersion: prompt.GenerationResultSchemaVersion,
		Operations:    operations,
		Message:       strings.TrimSpace(*wire.Message),
		Commands:      commands,
	}, nil
}

// summarizeGeneratedFiles 组装生成文件摘要，便于后续继续扩展日志或指标。
func summarizeGeneratedFiles(files []FileToGenerate) string {
	if len(files) == 0 {
		return "0 files"
	}
	paths := make([]string, 0, len(files))
	for _, file := range files {
		paths = append(paths, file.Path)
	}
	return fmt.Sprintf("%d files: %s", len(files), strings.Join(paths, ", "))
}
