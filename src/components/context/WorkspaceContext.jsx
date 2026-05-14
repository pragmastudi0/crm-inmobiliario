import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/api/supabaseClient";
import { CRM_APP_SLUG, TBL } from "@/api/entityApi";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ensureGoogleCalendarAccessToken,
  getClientId,
  isOAuthLinked,
  syncOAuthLinkedFlagFromProfile,
  isGoogleCalendarConnected,
} from "@/lib/googleCalendar";

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const { isLoadingAuth, isAuthenticated, user } = useAuth();
  const [workspace, setWorkspace] = useState(null);
  const [workspaceMember, setWorkspaceMember] = useState(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [googleCalendarConnected, setGoogleCalendarConnected] = useState(false);
  const [googleCalendarHadLinked, setGoogleCalendarHadLinked] = useState(false);
  const [calendarBannerTick, setCalendarBannerTick] = useState(0);

  const dismissGoogleCalendarBanner = useCallback(() => {
    if (user?.id) {
      sessionStorage.setItem(`gcal-disconnect-banner-dismissed-${user.id}`, "1");
    }
    setCalendarBannerTick((t) => t + 1);
  }, [user?.id]);

  const bootstrapWorkspace = useCallback(async () => {
    setWorkspaceLoading(true);
    try {
      const {
        data: { user: u },
      } = await supabase.auth.getUser();
      if (!u) {
        setWorkspace(null);
        setWorkspaceMember(null);
        setGoogleCalendarConnected(false);
        setGoogleCalendarHadLinked(false);
        return;
      }

      const { data: profileCal } = await supabase
        .from(TBL.profiles)
        .select("google_calendar_email, google_calendar_linked_at")
        .eq("id", u.id)
        .eq("app_slug", CRM_APP_SLUG)
        .maybeSingle();

      syncOAuthLinkedFlagFromProfile(profileCal || {});
      await ensureGoogleCalendarAccessToken();
      const connected = isGoogleCalendarConnected();
      setGoogleCalendarConnected(connected);
      const hadLinked = !!(
        profileCal?.google_calendar_email ||
        profileCal?.google_calendar_linked_at ||
        isOAuthLinked()
      );
      setGoogleCalendarHadLinked(hadLinked);

      if (connected && u.id) {
        sessionStorage.removeItem(`gcal-disconnect-banner-dismissed-${u.id}`);
        sessionStorage.removeItem(`gcal-disconnect-toast-${u.id}`);
      }

      const clientId = getClientId();
      const disconnected = clientId && !connected && hadLinked;
      if (disconnected && u.id && !sessionStorage.getItem(`gcal-disconnect-toast-${u.id}`)) {
        sessionStorage.setItem(`gcal-disconnect-toast-${u.id}`, "1");
        toast.warning(
          "Google Calendar está desconectado. La sincronización de seguimientos no funcionará hasta que reconectes.",
          { duration: 8000 }
        );
      }

      const { data: wid, error: rpcErr } = await supabase.rpc("ensure_workspace");
      if (rpcErr) throw rpcErr;

      if (!wid) {
        setWorkspace(null);
        setWorkspaceMember(null);
        const noticeKey = `crm-no-workspace-notice-${u.id}`;
        if (!user?.isPlatformAdmin && !sessionStorage.getItem(noticeKey)) {
          toast.info("Acceso correcto. Pedí acceso al administrador para que te asigne un equipo.");
          sessionStorage.setItem(noticeKey, "shown");
        }
        return;
      }

      const { data: ws, error: wsErr } = await supabase
        .from(TBL.workspaces)
        .select("*")
        .eq("id", wid)
        .eq("app_slug", CRM_APP_SLUG)
        .single();
      if (wsErr) throw wsErr;
      setWorkspace(ws);

      const { data: mem } = await supabase
        .from(TBL.workspace_members)
        .select("*")
        .eq("workspace_id", wid)
        .eq("user_id", u.id)
        .eq("app_slug", CRM_APP_SLUG)
        .maybeSingle();
      setWorkspaceMember(mem || null);
    } catch (err) {
      console.error("Error bootstrapping workspace:", err);
    } finally {
      setWorkspaceLoading(false);
    }
  }, [user?.id, user?.isPlatformAdmin]);

  const showGoogleCalendarDisconnectedAlert = useMemo(() => {
    const clientId = getClientId();
    if (!clientId || !googleCalendarHadLinked || googleCalendarConnected) return false;
    if (!user?.id) return false;
    if (sessionStorage.getItem(`gcal-disconnect-banner-dismissed-${user.id}`)) return false;
    return true;
  }, [
    googleCalendarHadLinked,
    googleCalendarConnected,
    user?.id,
    calendarBannerTick,
  ]);

  useEffect(() => {
    if (isLoadingAuth) return;
    if (!isAuthenticated) {
      setWorkspaceLoading(false);
      setWorkspace(null);
      setWorkspaceMember(null);
      setGoogleCalendarConnected(false);
      setGoogleCalendarHadLinked(false);
      return;
    }
    bootstrapWorkspace();
  }, [isLoadingAuth, isAuthenticated, user?.id, bootstrapWorkspace]);

  if (isLoadingAuth || workspaceLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Cargando workspace...</p>
        </div>
      </div>
    );
  }

  if (!workspace && !user?.isPlatformAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-lg font-semibold text-slate-900">Sin acceso asignado</h1>
          <p className="text-sm text-slate-600">
            Tu cuenta no está asociada a ningún equipo. Pedí acceso al administrador de la plataforma.
          </p>
          <Button variant="outline" onClick={() => supabase.auth.signOut({ scope: "local" })}>
            Cerrar sesión
          </Button>
        </div>
        <Button
          variant="secondary"
          className="fixed left-4 bottom-4"
          onClick={() => supabase.auth.signOut({ scope: "local" })}
        >
          Cerrar sesión
        </Button>
      </div>
    );
  }

  return (
    <WorkspaceContext.Provider
      value={{
        workspace,
        workspaceMember,
        workspaceLoading: false,
        isAdmin: workspaceMember?.role === "admin",
        refetchWorkspace: bootstrapWorkspace,
        googleCalendarConnected,
        googleCalendarHadLinked,
        showGoogleCalendarDisconnectedAlert,
        dismissGoogleCalendarBanner,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
