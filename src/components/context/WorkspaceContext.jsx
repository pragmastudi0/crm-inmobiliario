import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "@/api/supabaseClient";
import { CRM_APP_SLUG, TBL } from "@/api/entityApi";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const { isLoadingAuth, isAuthenticated, user } = useAuth();
  const [workspace, setWorkspace] = useState(null);
  const [workspaceMember, setWorkspaceMember] = useState(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(true);

  const bootstrapWorkspace = useCallback(async () => {
    setWorkspaceLoading(true);
    try {
      const {
        data: { user: u },
      } = await supabase.auth.getUser();
      if (!u) {
        setWorkspace(null);
        setWorkspaceMember(null);
        return;
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
  }, []);

  useEffect(() => {
    if (isLoadingAuth) return;
    if (!isAuthenticated) {
      setWorkspaceLoading(false);
      setWorkspace(null);
      setWorkspaceMember(null);
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
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
