import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'home': { paramsTuple?: []; params?: {} }
    'event_stream': { paramsTuple?: []; params?: {} }
    'subscribe': { paramsTuple?: []; params?: {} }
    'unsubscribe': { paramsTuple?: []; params?: {} }
    'mcp.post': { paramsTuple?: []; params?: {} }
    'resources.index': { paramsTuple: [ParamValue]; params: {'resource': ParamValue} }
    'resources.create': { paramsTuple: [ParamValue]; params: {'resource': ParamValue} }
    'resources.options': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'field': ParamValue} }
    'imports.store': { paramsTuple: [ParamValue]; params: {'resource': ParamValue} }
    'imports.index': { paramsTuple?: []; params?: {} }
    'imports.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'imports.start': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'record_collaboration.tag_options': { paramsTuple: [ParamValue]; params: {'resource': ParamValue} }
    'record_collaboration.show': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'record_collaboration.mentions': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'record_collaboration.comment': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'record_collaboration.edit_comment': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue,'comment': ParamValue} }
    'record_collaboration.delete_comment': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue,'comment': ParamValue} }
    'record_collaboration.follow': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'record_collaboration.tags': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'print': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'assignments.for_record': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'assignments.store': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'assignments.mine': { paramsTuple?: []; params?: {} }
    'assignments.complete': { paramsTuple: [ParamValue]; params: {'assignment': ParamValue} }
    'assignments.cancel': { paramsTuple: [ParamValue]; params: {'assignment': ParamValue} }
    'resources.edit': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'resources.show': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'resources.store': { paramsTuple: [ParamValue]; params: {'resource': ParamValue} }
    'resources.update': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'resources.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'resources.submit': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'resources.cancel': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'saved_views.store': { paramsTuple: [ParamValue]; params: {'resource': ParamValue} }
    'saved_views.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'attachments.store': { paramsTuple?: []; params?: {} }
    'attachments.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'api.open_api': { paramsTuple?: []; params?: {} }
    'api.resources.index': { paramsTuple: [ParamValue]; params: {'resource': ParamValue} }
    'api.resources.show': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'api.resources.store': { paramsTuple: [ParamValue]; params: {'resource': ParamValue} }
    'api.resources.update': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'api.resources.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'api.resources.submit': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'api.resources.cancel': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'user_invitations.show': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'user_invitations.accept': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'new_account.store': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'session.store': { paramsTuple?: []; params?: {} }
    'two_factor_challenge.create': { paramsTuple?: []; params?: {} }
    'two_factor_challenge.store': { paramsTuple?: []; params?: {} }
    'password_reset.forgot': { paramsTuple?: []; params?: {} }
    'password_reset.send': { paramsTuple?: []; params?: {} }
    'password_reset.reset': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'password_reset.update': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'oauth.redirect': { paramsTuple: [ParamValue]; params: {'provider': ParamValue} }
    'oauth.callback': { paramsTuple: [ParamValue]; params: {'provider': ParamValue} }
    'session.destroy': { paramsTuple?: []; params?: {} }
    'user_invitations.create': { paramsTuple?: []; params?: {} }
    'user_invitations.store': { paramsTuple?: []; params?: {} }
    'profile.show': { paramsTuple?: []; params?: {} }
    'profile.update': { paramsTuple?: []; params?: {} }
    'profile.password': { paramsTuple?: []; params?: {} }
    'two_factor.show': { paramsTuple?: []; params?: {} }
    'two_factor.begin': { paramsTuple?: []; params?: {} }
    'two_factor.confirm': { paramsTuple?: []; params?: {} }
    'two_factor.recovery': { paramsTuple?: []; params?: {} }
    'two_factor.disable': { paramsTuple?: []; params?: {} }
    'api_tokens.index': { paramsTuple?: []; params?: {} }
    'api_tokens.store': { paramsTuple?: []; params?: {} }
    'api_tokens.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'account_sessions.index': { paramsTuple?: []; params?: {} }
    'account_sessions.purge': { paramsTuple?: []; params?: {} }
    'account_sessions.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_sessions.index': { paramsTuple?: []; params?: {} }
    'admin_sessions.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'notifications.index': { paramsTuple?: []; params?: {} }
    'notifications.read_all': { paramsTuple?: []; params?: {} }
    'notifications.read': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_users.stop_impersonation': { paramsTuple?: []; params?: {} }
    'admin_users.index': { paramsTuple?: []; params?: {} }
    'admin_users.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_users.assign_role': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_users.remove_role': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'assignment': ParamValue} }
    'admin_users.assign_org_unit': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_users.remove_org_unit': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'orgUnit': ParamValue} }
    'admin_users.disable': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_users.enable': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_users.revoke_sessions': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_users.impersonate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_roles.index': { paramsTuple?: []; params?: {} }
    'admin_roles.store': { paramsTuple?: []; params?: {} }
    'admin_roles.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_roles.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_roles.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_roles.set_rule': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_roles.remove_rule': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'rule': ParamValue} }
    'admin_org_units.index': { paramsTuple?: []; params?: {} }
    'admin_org_units.store': { paramsTuple?: []; params?: {} }
    'admin_org_units.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_org_units.move': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_org_units.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_activity.index': { paramsTuple?: []; params?: {} }
    'admin_jobs.index': { paramsTuple?: []; params?: {} }
    'admin_jobs.retry': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_settings.index': { paramsTuple?: []; params?: {} }
    'admin_templates.index': { paramsTuple?: []; params?: {} }
    'admin_templates.update': { paramsTuple: [ParamValue]; params: {'key': ParamValue} }
    'admin_templates.reset': { paramsTuple: [ParamValue]; params: {'key': ParamValue} }
    'admin_webhooks.index': { paramsTuple?: []; params?: {} }
    'admin_webhooks.store': { paramsTuple?: []; params?: {} }
    'admin_webhooks.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_webhooks.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_webhooks.deliveries': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_webhooks.retry': { paramsTuple: [ParamValue]; params: {'delivery': ParamValue} }
    'setup.index': { paramsTuple?: []; params?: {} }
    'setup.check': { paramsTuple: [ParamValue]; params: {'service': ParamValue} }
    'setup.confirm_identity': { paramsTuple?: []; params?: {} }
    'setup.notification': { paramsTuple?: []; params?: {} }
    'admin_settings.test_mail': { paramsTuple?: []; params?: {} }
    'admin_settings.confirm_mail': { paramsTuple?: []; params?: {} }
    'admin_settings.upsert': { paramsTuple?: []; params?: {} }
    'admin_settings.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  GET: {
    'home': { paramsTuple?: []; params?: {} }
    'event_stream': { paramsTuple?: []; params?: {} }
    'resources.index': { paramsTuple: [ParamValue]; params: {'resource': ParamValue} }
    'resources.create': { paramsTuple: [ParamValue]; params: {'resource': ParamValue} }
    'resources.options': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'field': ParamValue} }
    'imports.index': { paramsTuple?: []; params?: {} }
    'imports.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'record_collaboration.tag_options': { paramsTuple: [ParamValue]; params: {'resource': ParamValue} }
    'record_collaboration.show': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'record_collaboration.mentions': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'print': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'assignments.for_record': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'assignments.mine': { paramsTuple?: []; params?: {} }
    'resources.edit': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'resources.show': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'attachments.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'api.open_api': { paramsTuple?: []; params?: {} }
    'api.resources.index': { paramsTuple: [ParamValue]; params: {'resource': ParamValue} }
    'api.resources.show': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'user_invitations.show': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'session.create': { paramsTuple?: []; params?: {} }
    'two_factor_challenge.create': { paramsTuple?: []; params?: {} }
    'password_reset.forgot': { paramsTuple?: []; params?: {} }
    'password_reset.reset': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'oauth.redirect': { paramsTuple: [ParamValue]; params: {'provider': ParamValue} }
    'oauth.callback': { paramsTuple: [ParamValue]; params: {'provider': ParamValue} }
    'user_invitations.create': { paramsTuple?: []; params?: {} }
    'profile.show': { paramsTuple?: []; params?: {} }
    'two_factor.show': { paramsTuple?: []; params?: {} }
    'api_tokens.index': { paramsTuple?: []; params?: {} }
    'account_sessions.index': { paramsTuple?: []; params?: {} }
    'admin_sessions.index': { paramsTuple?: []; params?: {} }
    'notifications.index': { paramsTuple?: []; params?: {} }
    'admin_users.index': { paramsTuple?: []; params?: {} }
    'admin_users.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_roles.index': { paramsTuple?: []; params?: {} }
    'admin_roles.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_org_units.index': { paramsTuple?: []; params?: {} }
    'admin_activity.index': { paramsTuple?: []; params?: {} }
    'admin_jobs.index': { paramsTuple?: []; params?: {} }
    'admin_settings.index': { paramsTuple?: []; params?: {} }
    'admin_templates.index': { paramsTuple?: []; params?: {} }
    'admin_webhooks.index': { paramsTuple?: []; params?: {} }
    'admin_webhooks.deliveries': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'setup.index': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'home': { paramsTuple?: []; params?: {} }
    'event_stream': { paramsTuple?: []; params?: {} }
    'resources.index': { paramsTuple: [ParamValue]; params: {'resource': ParamValue} }
    'resources.create': { paramsTuple: [ParamValue]; params: {'resource': ParamValue} }
    'resources.options': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'field': ParamValue} }
    'imports.index': { paramsTuple?: []; params?: {} }
    'imports.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'record_collaboration.tag_options': { paramsTuple: [ParamValue]; params: {'resource': ParamValue} }
    'record_collaboration.show': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'record_collaboration.mentions': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'print': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'assignments.for_record': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'assignments.mine': { paramsTuple?: []; params?: {} }
    'resources.edit': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'resources.show': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'attachments.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'api.open_api': { paramsTuple?: []; params?: {} }
    'api.resources.index': { paramsTuple: [ParamValue]; params: {'resource': ParamValue} }
    'api.resources.show': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'user_invitations.show': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'session.create': { paramsTuple?: []; params?: {} }
    'two_factor_challenge.create': { paramsTuple?: []; params?: {} }
    'password_reset.forgot': { paramsTuple?: []; params?: {} }
    'password_reset.reset': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'oauth.redirect': { paramsTuple: [ParamValue]; params: {'provider': ParamValue} }
    'oauth.callback': { paramsTuple: [ParamValue]; params: {'provider': ParamValue} }
    'user_invitations.create': { paramsTuple?: []; params?: {} }
    'profile.show': { paramsTuple?: []; params?: {} }
    'two_factor.show': { paramsTuple?: []; params?: {} }
    'api_tokens.index': { paramsTuple?: []; params?: {} }
    'account_sessions.index': { paramsTuple?: []; params?: {} }
    'admin_sessions.index': { paramsTuple?: []; params?: {} }
    'notifications.index': { paramsTuple?: []; params?: {} }
    'admin_users.index': { paramsTuple?: []; params?: {} }
    'admin_users.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_roles.index': { paramsTuple?: []; params?: {} }
    'admin_roles.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_org_units.index': { paramsTuple?: []; params?: {} }
    'admin_activity.index': { paramsTuple?: []; params?: {} }
    'admin_jobs.index': { paramsTuple?: []; params?: {} }
    'admin_settings.index': { paramsTuple?: []; params?: {} }
    'admin_templates.index': { paramsTuple?: []; params?: {} }
    'admin_webhooks.index': { paramsTuple?: []; params?: {} }
    'admin_webhooks.deliveries': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'setup.index': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'subscribe': { paramsTuple?: []; params?: {} }
    'unsubscribe': { paramsTuple?: []; params?: {} }
    'mcp.post': { paramsTuple?: []; params?: {} }
    'imports.store': { paramsTuple: [ParamValue]; params: {'resource': ParamValue} }
    'imports.start': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'record_collaboration.comment': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'assignments.store': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'assignments.complete': { paramsTuple: [ParamValue]; params: {'assignment': ParamValue} }
    'assignments.cancel': { paramsTuple: [ParamValue]; params: {'assignment': ParamValue} }
    'resources.store': { paramsTuple: [ParamValue]; params: {'resource': ParamValue} }
    'resources.submit': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'resources.cancel': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'saved_views.store': { paramsTuple: [ParamValue]; params: {'resource': ParamValue} }
    'attachments.store': { paramsTuple?: []; params?: {} }
    'api.resources.store': { paramsTuple: [ParamValue]; params: {'resource': ParamValue} }
    'api.resources.submit': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'api.resources.cancel': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'user_invitations.accept': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'new_account.store': { paramsTuple?: []; params?: {} }
    'session.store': { paramsTuple?: []; params?: {} }
    'two_factor_challenge.store': { paramsTuple?: []; params?: {} }
    'password_reset.send': { paramsTuple?: []; params?: {} }
    'password_reset.update': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'session.destroy': { paramsTuple?: []; params?: {} }
    'user_invitations.store': { paramsTuple?: []; params?: {} }
    'profile.password': { paramsTuple?: []; params?: {} }
    'two_factor.begin': { paramsTuple?: []; params?: {} }
    'two_factor.confirm': { paramsTuple?: []; params?: {} }
    'two_factor.recovery': { paramsTuple?: []; params?: {} }
    'two_factor.disable': { paramsTuple?: []; params?: {} }
    'api_tokens.store': { paramsTuple?: []; params?: {} }
    'notifications.read_all': { paramsTuple?: []; params?: {} }
    'notifications.read': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_users.stop_impersonation': { paramsTuple?: []; params?: {} }
    'admin_users.assign_role': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_users.assign_org_unit': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_users.disable': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_users.enable': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_users.revoke_sessions': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_users.impersonate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_roles.store': { paramsTuple?: []; params?: {} }
    'admin_org_units.store': { paramsTuple?: []; params?: {} }
    'admin_org_units.move': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_jobs.retry': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_webhooks.store': { paramsTuple?: []; params?: {} }
    'admin_webhooks.retry': { paramsTuple: [ParamValue]; params: {'delivery': ParamValue} }
    'setup.check': { paramsTuple: [ParamValue]; params: {'service': ParamValue} }
    'setup.confirm_identity': { paramsTuple?: []; params?: {} }
    'setup.notification': { paramsTuple?: []; params?: {} }
    'admin_settings.test_mail': { paramsTuple?: []; params?: {} }
    'admin_settings.confirm_mail': { paramsTuple?: []; params?: {} }
  }
  PATCH: {
    'record_collaboration.edit_comment': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue,'comment': ParamValue} }
    'resources.update': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'api.resources.update': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'profile.update': { paramsTuple?: []; params?: {} }
    'admin_roles.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_org_units.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  DELETE: {
    'record_collaboration.delete_comment': { paramsTuple: [ParamValue,ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue,'comment': ParamValue} }
    'resources.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'saved_views.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'api.resources.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'api_tokens.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'account_sessions.purge': { paramsTuple?: []; params?: {} }
    'account_sessions.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_sessions.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_users.remove_role': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'assignment': ParamValue} }
    'admin_users.remove_org_unit': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'orgUnit': ParamValue} }
    'admin_roles.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_roles.remove_rule': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'rule': ParamValue} }
    'admin_org_units.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_templates.reset': { paramsTuple: [ParamValue]; params: {'key': ParamValue} }
    'admin_webhooks.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_settings.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  PUT: {
    'record_collaboration.follow': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'record_collaboration.tags': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'admin_roles.set_rule': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_templates.update': { paramsTuple: [ParamValue]; params: {'key': ParamValue} }
    'admin_webhooks.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_settings.upsert': { paramsTuple?: []; params?: {} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}