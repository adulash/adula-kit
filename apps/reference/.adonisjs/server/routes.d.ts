import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'home': { paramsTuple?: []; params?: {} }
    'mcp.post': { paramsTuple?: []; params?: {} }
    'resources.index': { paramsTuple: [ParamValue]; params: {'resource': ParamValue} }
    'resources.create': { paramsTuple: [ParamValue]; params: {'resource': ParamValue} }
    'resources.options': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'field': ParamValue} }
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
    'new_account.create': { paramsTuple?: []; params?: {} }
    'user_invitations.show': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'user_invitations.accept': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'new_account.store': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'session.store': { paramsTuple?: []; params?: {} }
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
    'resources.index': { paramsTuple: [ParamValue]; params: {'resource': ParamValue} }
    'resources.create': { paramsTuple: [ParamValue]; params: {'resource': ParamValue} }
    'resources.options': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'field': ParamValue} }
    'resources.edit': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'resources.show': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'attachments.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'user_invitations.show': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'session.create': { paramsTuple?: []; params?: {} }
    'password_reset.forgot': { paramsTuple?: []; params?: {} }
    'password_reset.reset': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'oauth.redirect': { paramsTuple: [ParamValue]; params: {'provider': ParamValue} }
    'oauth.callback': { paramsTuple: [ParamValue]; params: {'provider': ParamValue} }
    'user_invitations.create': { paramsTuple?: []; params?: {} }
    'profile.show': { paramsTuple?: []; params?: {} }
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
    'setup.index': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'home': { paramsTuple?: []; params?: {} }
    'resources.index': { paramsTuple: [ParamValue]; params: {'resource': ParamValue} }
    'resources.create': { paramsTuple: [ParamValue]; params: {'resource': ParamValue} }
    'resources.options': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'field': ParamValue} }
    'resources.edit': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'resources.show': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'attachments.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'user_invitations.show': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'session.create': { paramsTuple?: []; params?: {} }
    'password_reset.forgot': { paramsTuple?: []; params?: {} }
    'password_reset.reset': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'oauth.redirect': { paramsTuple: [ParamValue]; params: {'provider': ParamValue} }
    'oauth.callback': { paramsTuple: [ParamValue]; params: {'provider': ParamValue} }
    'user_invitations.create': { paramsTuple?: []; params?: {} }
    'profile.show': { paramsTuple?: []; params?: {} }
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
    'setup.index': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'mcp.post': { paramsTuple?: []; params?: {} }
    'resources.store': { paramsTuple: [ParamValue]; params: {'resource': ParamValue} }
    'resources.submit': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'resources.cancel': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'saved_views.store': { paramsTuple: [ParamValue]; params: {'resource': ParamValue} }
    'attachments.store': { paramsTuple?: []; params?: {} }
    'user_invitations.accept': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'new_account.store': { paramsTuple?: []; params?: {} }
    'session.store': { paramsTuple?: []; params?: {} }
    'password_reset.send': { paramsTuple?: []; params?: {} }
    'password_reset.update': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'session.destroy': { paramsTuple?: []; params?: {} }
    'user_invitations.store': { paramsTuple?: []; params?: {} }
    'profile.password': { paramsTuple?: []; params?: {} }
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
    'setup.check': { paramsTuple: [ParamValue]; params: {'service': ParamValue} }
    'setup.confirm_identity': { paramsTuple?: []; params?: {} }
    'setup.notification': { paramsTuple?: []; params?: {} }
    'admin_settings.test_mail': { paramsTuple?: []; params?: {} }
    'admin_settings.confirm_mail': { paramsTuple?: []; params?: {} }
  }
  PATCH: {
    'resources.update': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'profile.update': { paramsTuple?: []; params?: {} }
    'admin_roles.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_org_units.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  DELETE: {
    'resources.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'saved_views.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'resource': ParamValue,'id': ParamValue} }
    'account_sessions.purge': { paramsTuple?: []; params?: {} }
    'account_sessions.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_sessions.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_users.remove_role': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'assignment': ParamValue} }
    'admin_users.remove_org_unit': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'orgUnit': ParamValue} }
    'admin_roles.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_roles.remove_rule': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'rule': ParamValue} }
    'admin_org_units.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_settings.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  PUT: {
    'admin_roles.set_rule': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_settings.upsert': { paramsTuple?: []; params?: {} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}