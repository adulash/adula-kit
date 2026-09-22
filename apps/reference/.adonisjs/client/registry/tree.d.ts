/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  home: typeof routes['home']
  mcp: {
    post: typeof routes['mcp.post']
  }
  resources: {
    index: typeof routes['resources.index']
    create: typeof routes['resources.create']
    options: typeof routes['resources.options']
    edit: typeof routes['resources.edit']
    show: typeof routes['resources.show']
    store: typeof routes['resources.store']
    update: typeof routes['resources.update']
    destroy: typeof routes['resources.destroy']
    submit: typeof routes['resources.submit']
    cancel: typeof routes['resources.cancel']
  }
  savedViews: {
    store: typeof routes['saved_views.store']
    destroy: typeof routes['saved_views.destroy']
  }
  attachments: {
    store: typeof routes['attachments.store']
    show: typeof routes['attachments.show']
  }
  newAccount: {
    create: typeof routes['new_account.create']
    store: typeof routes['new_account.store']
  }
  userInvitations: {
    show: typeof routes['user_invitations.show']
    accept: typeof routes['user_invitations.accept']
    create: typeof routes['user_invitations.create']
    store: typeof routes['user_invitations.store']
  }
  session: {
    create: typeof routes['session.create']
    store: typeof routes['session.store']
    destroy: typeof routes['session.destroy']
  }
  passwordReset: {
    forgot: typeof routes['password_reset.forgot']
    send: typeof routes['password_reset.send']
    reset: typeof routes['password_reset.reset']
    update: typeof routes['password_reset.update']
  }
  oauth: {
    redirect: typeof routes['oauth.redirect']
    callback: typeof routes['oauth.callback']
  }
  profile: {
    show: typeof routes['profile.show']
    update: typeof routes['profile.update']
    password: typeof routes['profile.password']
  }
  accountSessions: {
    index: typeof routes['account_sessions.index']
    purge: typeof routes['account_sessions.purge']
    destroy: typeof routes['account_sessions.destroy']
  }
  adminSessions: {
    index: typeof routes['admin_sessions.index']
    destroy: typeof routes['admin_sessions.destroy']
  }
  notifications: {
    index: typeof routes['notifications.index']
    readAll: typeof routes['notifications.read_all']
    read: typeof routes['notifications.read']
  }
  adminUsers: {
    stopImpersonation: typeof routes['admin_users.stop_impersonation']
    index: typeof routes['admin_users.index']
    show: typeof routes['admin_users.show']
    assignRole: typeof routes['admin_users.assign_role']
    removeRole: typeof routes['admin_users.remove_role']
    assignOrgUnit: typeof routes['admin_users.assign_org_unit']
    removeOrgUnit: typeof routes['admin_users.remove_org_unit']
    disable: typeof routes['admin_users.disable']
    enable: typeof routes['admin_users.enable']
    revokeSessions: typeof routes['admin_users.revoke_sessions']
    impersonate: typeof routes['admin_users.impersonate']
  }
  adminRoles: {
    index: typeof routes['admin_roles.index']
    store: typeof routes['admin_roles.store']
    show: typeof routes['admin_roles.show']
    update: typeof routes['admin_roles.update']
    destroy: typeof routes['admin_roles.destroy']
    setRule: typeof routes['admin_roles.set_rule']
    removeRule: typeof routes['admin_roles.remove_rule']
  }
  adminOrgUnits: {
    index: typeof routes['admin_org_units.index']
    store: typeof routes['admin_org_units.store']
    update: typeof routes['admin_org_units.update']
    move: typeof routes['admin_org_units.move']
    destroy: typeof routes['admin_org_units.destroy']
  }
  adminActivity: {
    index: typeof routes['admin_activity.index']
  }
  adminJobs: {
    index: typeof routes['admin_jobs.index']
    retry: typeof routes['admin_jobs.retry']
  }
  adminSettings: {
    index: typeof routes['admin_settings.index']
    testMail: typeof routes['admin_settings.test_mail']
    confirmMail: typeof routes['admin_settings.confirm_mail']
    upsert: typeof routes['admin_settings.upsert']
    destroy: typeof routes['admin_settings.destroy']
  }
  setup: {
    index: typeof routes['setup.index']
    check: typeof routes['setup.check']
    confirmIdentity: typeof routes['setup.confirm_identity']
    notification: typeof routes['setup.notification']
  }
}
