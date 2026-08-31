import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
function read(file){return fs.readFileSync(path.join(root,file),'utf8');}
function requireText(file,fragments){const source=read(file);for(const fragment of fragments){if(!source.includes(fragment))throw new Error(`${file} missing contract: ${fragment}`);}}

requireText('backend/init.sql',[
 'CREATE TABLE IF NOT EXISTS public.project_members',
 'CREATE TABLE IF NOT EXISTS public.project_collaboration_audits',
 'CREATE TABLE IF NOT EXISTS public.official_project_templates',
 'CREATE TABLE IF NOT EXISTS public.official_project_template_versions',
 'CREATE OR REPLACE FUNCTION public.mutate_project_member',
 'CREATE OR REPLACE FUNCTION public.publish_official_project_template_version',
 'CREATE OR REPLACE FUNCTION public.rollback_official_project_template_version',
 'ENABLE ROW LEVEL SECURITY',
 'template current version conflict',
]);
requireText('backend/internal/service/project_access_guard.go',['AccessRole','CanRead()','CanWrite()','CanManage()','collaborationRepo.FindMember']);
requireText('backend/internal/handler/project.go',['projectRequestAccessAllowed','decision.CanRead()','decision.CanWrite()','decision.CanManage()']);
requireText('backend/internal/handler/github_integration_handler.go',['!decision.CanManage()']);
requireText('backend/internal/handler/project_deployment_handler.go',['!decision.CanManage()']);
requireText('backend/internal/service/project_collaboration_service.go',[
 'member_confirmation_required','project_owner_required','ProjectMemberRoleViewer','ProjectMemberRoleEditor',
 'normalizeTemplateFiles','templateChecksum','template_current_version_conflict','cleanupTemplateProject',
 'commitOfficialTemplateProject','Initialize from official template','EnsureBuiltinTemplates',
]);
requireText('backend/internal/repository/project_collaboration_repository.go',['Transaction(func(tx *gorm.DB)','stored.CurrentVersionID != audit.ExpectedCurrentVersion']);
requireText('backend/pkg/supabase/project_collaboration_repository.go',['rpc/mutate_project_member','rpc/publish_official_project_template_version','rpc/rollback_official_project_template_version']);
requireText('backend/cmd/server/main.go',[
 '/:id/access','/:id/members','/:id/collaboration-audits','/templates/create',
 '/project-templates/:template_id/rollback',
]);
requireText('backend/internal/service/project_collaboration_service_test.go',[
 'TestProjectCollaborationMemberLifecycleAndRoles','TestProjectCollaborationRejectsUnconfirmedAndNonOwnerMutation',
 'TestOfficialTemplateVersionPublishAndRollback','TestOfficialTemplateRejectsUnsafePathAndTamperedChecksum',
]);
requireText('src/app/projects/[id]/collaboration/page.tsx',['项目协作','成员与权限','成员审计']);
requireText('src/app/templates/page.tsx',['官方模板','使用此版本创建项目']);
requireText('src/app/admin/project-templates/page.tsx',['官方项目模板','发布新版本','回滚']);
requireText('src/app/workspace/workspace-ide-desktop-git-panel.tsx',['/collaboration','项目协作']);
requireText('src/app/workspace/workspace-ide-mobile-git-panel.tsx',['/collaboration','项目协作']);

console.log('[YES] PLATFORM-001 R6.4 collaboration and official template contract valid.');
