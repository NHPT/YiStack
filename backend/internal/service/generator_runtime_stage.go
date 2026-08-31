package service

import (
	"context"
	"strings"

	"yistack/internal/model"
)

type generationRuntimeStageResult struct {
	project           *model.Project
	projectDir        string
	projectContext    string
	workspaceSnapshot *GenerationWorkspaceSnapshot
}

func (s *GeneratorService) prepareGenerationRuntimeStage(ctx context.Context, req *GenerateRequest, handler StreamEventHandler) (generationRuntimeStageResult, error) {
	_ = emitWorkflowStep(handler, "load-project-context", "read_file", "读取项目上下文", "正在读取项目已有上下文和工作目录信息。", "running", nil)
	project, projectDir, projectContext, contextErr := s.loadGenerationProject(ctx, req.ProjectID)
	if contextErr != nil {
		_ = emitProjectPromptContextConflict(handler, req, contextErr)
		return generationRuntimeStageResult{}, contextErr
	}
	_ = emitWorkflowStep(handler, "load-project-context", "read_file", "读取项目上下文", "项目上下文已载入，可用于后续连续生成。", "done", map[string]interface{}{
		"hasProject": project != nil,
		"hasContext": strings.TrimSpace(projectContext) != "",
	})

	_ = emitWorkflowStep(handler, "prepare-runtime", "run_command", "检查开发环境", "正在确认容器和运行时已准备完成。", "running", nil)
	if err := s.ensureRuntimeForGeneration(ctx, project, handler); err != nil {
		_ = emitWorkflowStep(handler, "prepare-runtime", "run_command", "检查开发环境", err.Error(), "failed", nil)
		return generationRuntimeStageResult{}, err
	}
	_ = emitWorkflowStep(handler, "prepare-runtime", "run_command", "检查开发环境", "运行时环境已就绪。", "done", map[string]interface{}{
		"projectDir": projectDir,
	})

	var workspaceSnapshot *GenerationWorkspaceSnapshot
	if project != nil && strings.TrimSpace(req.ProjectID) != "" && s.containerMgr != nil {
		_ = emitWorkflowStep(handler, "load-workspace-snapshot", "read_file", "读取文件快照", "正在读取受限文本文件及 SHA-256。", "running", nil)
		workspaceSnapshot, contextErr = loadGenerationWorkspaceSnapshot(ctx, s.containerMgr, req.ProjectID)
		if contextErr != nil {
			_ = emitWorkflowStep(handler, "load-workspace-snapshot", "read_file", "读取文件快照", contextErr.Error(), "failed", nil)
			return generationRuntimeStageResult{}, contextErr
		}
		projectContext = strings.TrimSpace(strings.Join([]string{
			projectContext,
			renderGenerationWorkspaceSnapshot(workspaceSnapshot),
		}, "\n\n"))
		_ = emitWorkflowStep(handler, "load-workspace-snapshot", "read_file", "读取文件快照", "文件快照已载入，可用于受控 patch。", "done", map[string]interface{}{
			"snapshot_files": len(workspaceSnapshot.Files),
			"omitted_files":  workspaceSnapshot.OmittedFiles,
		})
	}
	projectContext = appendSupabaseAppPresetContext(projectContext, req, project)

	return generationRuntimeStageResult{
		project:           project,
		projectDir:        projectDir,
		projectContext:    projectContext,
		workspaceSnapshot: workspaceSnapshot,
	}, nil
}
