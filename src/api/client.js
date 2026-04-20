import { supabase } from '@/api/supabaseClient';
import { entities, TBL } from '@/api/entityApi';

export async function inviteWorkspaceMember({ email, role, workspaceId }) {
  const { data, error } = await supabase.functions.invoke('invite-workspace-member', {
    body: {
      email: email.trim().toLowerCase(),
      role: role === 'admin' ? 'admin' : 'member',
      workspace_id: workspaceId,
    },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export const api = {
  entities,
  auth: {
    async me() {
      const {
        data: { user },
        error: uerr,
      } = await supabase.auth.getUser();
      if (uerr || !user) {
        const err = new Error('Unauthorized');
        err.status = 401;
        throw err;
      }
      const { data: profile } = await supabase.from(TBL.profiles).select('*').eq('id', user.id).maybeSingle();
      return {
        id: user.id,
        email: user.email,
        full_name: profile?.full_name,
        is_platform_admin: profile?.is_platform_admin ?? false,
        consulta_follow_up_days: profile?.consulta_follow_up_days,
        postventa_follow_up_days: profile?.postventa_follow_up_days,
      };
    },
    async updateMe(patch) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Unauthorized');
      const allowed = {};
      if (patch.consulta_follow_up_days !== undefined) {
        allowed.consulta_follow_up_days = Number(patch.consulta_follow_up_days);
      }
      if (patch.postventa_follow_up_days !== undefined) {
        allowed.postventa_follow_up_days = Number(patch.postventa_follow_up_days);
      }
      const { error } = await supabase.from(TBL.profiles).update(allowed).eq('id', user.id);
      if (error) throw error;
    },
    async logout(redirect) {
      await supabase.auth.signOut();
      if (redirect) window.location.href = '/Login';
    },
    redirectToLogin() {
      window.location.href = '/Login';
    },
  },
  functions: {
    async invoke() {
      return { data: null };
    },
  },
  users: {
    async inviteUser() {
      throw new Error('Usá inviteWorkspaceMember desde Miembros del workspace');
    },
  },
  appLogs: {
    logUserInApp() {
      return Promise.resolve();
    },
  },
};

export { supabase };
