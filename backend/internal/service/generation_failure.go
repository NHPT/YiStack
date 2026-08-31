package service

import (
	"errors"
	"fmt"
	"strings"
)

const (
	GenerationFailureCodeSchemaInvalid           = "generation_schema_invalid"
	GenerationFailureCodeFileConflict            = "generation_file_conflict"
	GenerationFailureCodeCommandFailed           = "generation_command_failed"
	GenerationFailureCodeProjectValidationFailed = "project_validation_failed"
	GenerationFailureCodeBrowserAcceptanceFailed = "browser_acceptance_failed"
	GenerationFailureCodeRepairResultInvalid     = "repair_result_invalid"
	GenerationFailureCodeRepairBudgetExhausted   = "repair_budget_exhausted"
	GenerationFailureCodeRepairRepeatedFailure   = "repair_repeated_failure"
)

// GenerationFailureError 描述必须阻断生成收口的结构化失败。
type GenerationFailureError struct {
	Code              string
	Stage             string
	Message           string
	Details           string
	Command           string
	ExitCode          *int
	Check             string
	ValidationResult  *ProjectValidationResult
	FileConflict      *GenerationFileConflict
	RepairEvidence    *GenerationRepairEvidence
	BrowserAcceptance *BrowserAcceptanceResult
	Err               error
}

func newProjectValidationFailure(
	check string,
	command []string,
	exitCode *int,
	details string,
	result *ProjectValidationResult,
	err error,
) *GenerationFailureError {
	finalizeProjectValidationFailure(result)
	return &GenerationFailureError{
		Code:             GenerationFailureCodeProjectValidationFailed,
		Stage:            "project_validation",
		Message:          "生成项目质量校验失败",
		Details:          strings.TrimSpace(details),
		Command:          strings.Join(command, " "),
		ExitCode:         exitCode,
		Check:            strings.TrimSpace(check),
		ValidationResult: result,
		Err:              err,
	}
}

func (e *GenerationFailureError) Error() string {
	if e == nil {
		return ""
	}
	message := strings.TrimSpace(e.Message)
	details := strings.TrimSpace(e.Details)
	switch {
	case message != "" && details != "":
		return message + ": " + details
	case message != "":
		return message
	case details != "":
		return details
	case e.Err != nil:
		return e.Err.Error()
	default:
		return "generation failed"
	}
}

func (e *GenerationFailureError) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.Err
}

// GenerationFailureCode 读取结构化生成失败的稳定原因码。
func GenerationFailureCode(err error) string {
	var failure *GenerationFailureError
	if errors.As(err, &failure) {
		return strings.TrimSpace(failure.Code)
	}
	return ""
}

func newGenerationSchemaFailure(err error) *GenerationFailureError {
	details := "模型返回内容不符合 generation_result.v2"
	if err != nil {
		details = err.Error()
	}
	return &GenerationFailureError{
		Code:    GenerationFailureCodeSchemaInvalid,
		Stage:   "generation_result_validation",
		Message: "生成结果协议校验失败",
		Details: details,
		Err:     err,
	}
}

func newGenerationFileConflict(operation GenerationFileOperation, kind, expectedHash, actualHash, details string, err error) *GenerationFailureError {
	details = strings.TrimSpace(details)
	conflict := &GenerationFileConflict{
		Operation: operation.Operation, Path: operation.Path, Kind: strings.TrimSpace(kind),
		ExpectedHash: strings.TrimSpace(expectedHash), ActualHash: strings.TrimSpace(actualHash), Message: details,
	}
	return &GenerationFailureError{
		Code: GenerationFailureCodeFileConflict, Stage: "generation_file_apply",
		Message: "生成文件操作被阻断", Details: details, FileConflict: conflict, Err: err,
	}
}

func newGenerationRepairFailure(code string, validation *ProjectValidationResult, evidence *GenerationRepairEvidence, err error) *GenerationFailureError {
	details := "repair failed"
	if err != nil {
		details = err.Error()
	}
	return &GenerationFailureError{
		Code: code, Stage: "generation_repair", Message: "有限自动修复未通过", Details: details,
		ValidationResult: validation, RepairEvidence: evidence, Err: err,
	}
}

func newGenerationCommandFailure(command string, exitCode *int, details string, err error) *GenerationFailureError {
	command = strings.TrimSpace(command)
	details = strings.TrimSpace(details)
	if details == "" && err != nil {
		details = err.Error()
	}
	if details == "" && exitCode != nil {
		details = fmt.Sprintf("command exited with code %d", *exitCode)
	}
	return &GenerationFailureError{
		Code:     GenerationFailureCodeCommandFailed,
		Stage:    "generation_command",
		Check:    "execution",
		Message:  "生成命令执行失败",
		Details:  details,
		Command:  command,
		ExitCode: exitCode,
		Err:      err,
	}
}

func isRepairableGenerationCommandFailure(err error) bool {
	var failure *GenerationFailureError
	return errors.As(err, &failure) &&
		failure.Code == GenerationFailureCodeCommandFailed &&
		failure.Check == "execution"
}

func newGenerationBrowserAcceptanceFailure(result *BrowserAcceptanceResult, err error) *GenerationFailureError {
	details := "browser acceptance failed"
	if err != nil {
		details = err.Error()
	}
	return &GenerationFailureError{
		Code: GenerationFailureCodeBrowserAcceptanceFailed, Stage: "browser_acceptance",
		Message: "生成应用浏览器验收失败", Details: details, BrowserAcceptance: result, Err: err,
	}
}
