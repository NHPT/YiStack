package orchestration

import "yistack/internal/service"

func prepareGenerateCommandVisualEdit(command *GenerateCommand) error {
	if command == nil || command.VisualEditPrepared {
		return nil
	}
	prepared, err := service.PrepareVisualEditContext(command.VisualEdit)
	if err != nil {
		return err
	}
	command.VisualEdit = prepared
	command.VisualEditPrepared = true
	return nil
}
