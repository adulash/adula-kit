export { defineResource, columnName } from './src/resource/define_resource.js'
export { configure } from './configure.js'
export { withKitDatabase } from './src/database/configure.js'
export { createResourceController } from './src/admin/controller.js'
export type {
  ResourceRuntime,
  ResourceList,
  ResourceEditor,
  ResourceShow,
  ResourceChildren,
  ResourceLookups,
  ResourceActivity,
} from './src/admin/controller.js'
export type * from './src/admin/presentation.js'
export { ResourceRegistry } from './src/resource/registry.js'
export type * from './src/resource/types.js'
export { buildAbility, canRecord, inOrgScope } from './src/auth/ability.js'
export { packedResourceRules } from './src/auth/packed_rules.js'
export type { Actor, Rule, KitAbility } from './src/auth/ability.js'
export { ActorStore } from './src/auth/actor_store.js'
export { accessibleBy, authorizationSql, conditionSql } from './src/auth/sql.js'
export { ResourceService } from './src/admin/resource_service.js'
export { serialize, writableInput, selectedFields } from './src/admin/contracts.js'
export { KitError } from './src/admin/errors.js'
export {
  createCoreSchema,
  createResourceTable,
  createAttachmentsSchema,
  createSavedViewsSchema,
  createCollaborationSchema,
  createAssignmentsSchema,
  createMessagingSchema,
} from './src/database/schema.js'
export {
  MessageTemplates,
  DEFAULT_TEMPLATES,
  renderTemplate,
  notifyWithTemplate,
  deliverNotificationMail,
  listenForNotifications,
} from './src/core/message_templates.js'
export type {
  TemplateDefinition,
  MessageTemplate,
  RenderedMessage,
  MailSender,
  NotificationSignal,
} from './src/core/message_templates.js'
export { Assignments } from './src/collaboration/assignments.js'
export type {
  Assignment,
  AssignmentPage,
  AssignmentStatus,
} from './src/collaboration/assignments.js'
export { RecordCollaboration, followerListeners } from './src/collaboration/record_collaboration.js'
export type {
  ActorLoader,
  CommentEntry,
  FieldChangeEntry,
  RecordCollaborationState,
  MentionCandidate,
} from './src/collaboration/record_collaboration.js'
export type { FieldChange } from './src/events/record_mutation.js'
export {
  registerUpload,
  findAttachment,
  loadAttachments,
  claimAttachment,
  releaseAttachment,
  summarizeAttachment,
  attachmentUrl,
  isAttachmentId,
  isRelativeDiskPath,
  attachmentPolicy,
  pendingUploadCount,
  staleUploads,
  forgetUpload,
  DEFAULT_ATTACHMENT_EXTENSIONS,
  PENDING_UPLOAD_LIMIT,
  UNBOUND_UPLOAD_TTL_MS,
} from './src/attachments/attachment_service.js'
export type {
  AttachmentRecord,
  AttachmentSummary,
  UploadInput,
  ClaimInput,
} from './src/attachments/attachment_service.js'
export { migrateStorage } from './src/attachments/storage_migrate.js'
export type {
  StorageDisk,
  StorageMigrationOptions,
  StorageMigrationResult,
} from './src/attachments/storage_migrate.js'
export { diagnoseAttachments } from './src/attachments/doctor.js'
export { Settings, sequence, notify } from './src/services/settings.js'
export {
  uiPreferences,
  validateUiPreferences,
  UI_PREFERENCES_KEY,
  DEFAULT_UI_PREFERENCES,
} from './src/core/ui_preferences.js'
export type {
  UiPreferences,
  CalendarSystem,
  CalendarPreference,
} from './src/core/ui_preferences.js'
export { moveOrgUnit } from './src/org/org_service.js'
export { publishOutbox, consumeEvent } from './src/events/outbox.js'
export type { Jobs, DomainEvent, Listener } from './src/events/outbox.js'
export { AdonisJobs } from './src/events/adonis_jobs.js'
export { recordMutation } from './src/events/record_mutation.js'
export { assessBackup, verifyBackup } from './src/services/backup.js'
export type { BackupObject, BackupStatus } from './src/services/backup.js'
export { ActivityAdmin, logActivity } from './src/core/activity.js'
export type {
  ActivityEntry,
  ActivityFilters,
  ActivityPage,
  ActivityRow,
} from './src/core/activity.js'
export { RolesAdmin, ALL_SUBJECT_LABEL } from './src/core/roles.js'
export type {
  RoleSummary,
  RoleDetail,
  RoleRule,
  RuleInput,
  RoleMatrix,
  MatrixSubject,
  MatrixField,
} from './src/core/roles.js'
export { UsersAdmin } from './src/core/users.js'
export { UserInvitations, type InvitationDelivery } from './src/core/user_invitations.js'
export type { UserSummary, UserPage, UserRoleAssignment, UserOrgUnit } from './src/core/users.js'
export { OrgUnitsAdmin } from './src/core/org_units.js'
export type { OrgUnitNode } from './src/core/org_units.js'
export { SavedViews } from './src/core/saved_views.js'
export type { SavedView, SavedViewQuery } from './src/core/saved_views.js'
export { NotificationsAdmin } from './src/core/notifications.js'
export type { Notification, NotificationPage } from './src/core/notifications.js'
export {
  SettingsAdmin,
  isProtectedSetting,
  parseSettingValue,
  SETTING_SCOPES,
  PROTECTED_SETTING_KEYS,
} from './src/core/settings.js'
export type { SettingScope, SettingRow, SettingInput } from './src/core/settings.js'
export {
  runtimeHealth,
  isBackupStale,
  backupStale,
  heartbeat,
  HEARTBEAT_MAX_AGE_MS,
  BACKUP_MAX_AGE_MS,
} from './src/core/health.js'
export type {
  RuntimeHealth,
  HeartbeatStatus,
  QueueSnapshot,
  QueueCounts,
  FailedJob,
} from './src/core/health.js'
export { MailDeliveryTest, MAIL_TEST_KEY, type MailTestState } from './src/core/mail_test.js'
export { InitialSetup, type SetupCheck } from './src/core/setup.js'
