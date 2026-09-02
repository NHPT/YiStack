package orchestration

import (
	"context"

	"yistack/internal/service"
)

func prepareGenerateCommandVisualAttachments(command *GenerateCommand) error {
	if command == nil || command.VisualAttachmentsPrepared {
		return nil
	}
	prepared, err := service.PrepareVisualAttachments(command.VisualAttachments)
	if err != nil {
		return err
	}
	command.VisualAttachments = prepared
	command.VisualAttachmentsPrepared = true
	return nil
}

func prepareGeneratePlansCommandVisualAttachments(command *GeneratePlansCommand) error {
	if command == nil || command.VisualAttachmentsPrepared {
		return nil
	}
	prepared, err := service.PrepareVisualAttachments(command.VisualAttachments)
	if err != nil {
		return err
	}
	command.VisualAttachments = prepared
	command.VisualAttachmentsPrepared = true
	return nil
}

func prepareGenerateCommandVisualContext(
	ctx context.Context,
	generatorService *service.GeneratorService,
	command *GenerateCommand,
) error {
	if command == nil {
		return nil
	}
	if len(command.VisualAttachments) > 0 {
		command.VisualContext = nil
		return nil
	}
	if command.VisualContext == nil {
		return nil
	}
	trustedContext, err := generatorService.BindProjectVisualContext(ctx, command.ProjectID, command.VisualContext)
	if err != nil {
		return err
	}
	command.VisualContext = trustedContext
	return nil
}
