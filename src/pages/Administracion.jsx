import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import { useWorkspace } from "@/components/context/WorkspaceContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

async function fetchAdminWorkspaces() {
  const { data, error } = await supabase.rpc("crm_inmobiliario_admin_list_workspaces");
  if (error) throw error;
  return data ?? [];
}

async function fetchUsersWithoutWorkspace() {
  const { data, error } = await supabase.rpc("crm_inmobiliario_admin_list_users_without_workspace");
  if (error) throw error;
  return data ?? [];
}

export default function Administracion() {
  const { user } = useAuth();
  const { refetchWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [newWsName, setNewWsName] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [addWsId, setAddWsId] = useState("");
  const [addUserId, setAddUserId] = useState("");
  const [addRole, setAddRole] = useState("member");

  const { data: workspaces = [], isLoading: loadingWs } = useQuery({
    queryKey: ["admin-workspaces"],
    queryFn: fetchAdminWorkspaces,
    enabled: !!user?.isPlatformAdmin,
  });

  const { data: sinEquipo = [], isLoading: loadingUsers } = useQuery({
    queryKey: ["admin-users-sin-workspace"],
    queryFn: fetchUsersWithoutWorkspace,
    enabled: !!user?.isPlatformAdmin,
  });

  const createWsMutation = useMutation({
    mutationFn: async ({ name, owner_user_id }) => {
      const { data, error } = await supabase.rpc("crm_inmobiliario_admin_create_workspace", {
        p_name: name,
        p_owner_user_id: owner_user_id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Equipo creado");
      setNewWsName("");
      setOwnerId("");
      queryClient.invalidateQueries({ queryKey: ["admin-workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users-sin-workspace"] });
      refetchWorkspace?.();
    },
    onError: (e) => toast.error(e.message || "Error al crear equipo"),
  });

  const addMemberMutation = useMutation({
    mutationFn: async ({ workspace_id, user_id, role }) => {
      const { error } = await supabase.rpc("crm_inmobiliario_admin_add_member", {
        p_workspace_id: workspace_id,
        p_user_id: user_id,
        p_role: role,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Usuario asignado al equipo");
      setAddUserId("");
      queryClient.invalidateQueries({ queryKey: ["admin-users-sin-workspace"] });
      refetchWorkspace?.();
    },
    onError: (e) => toast.error(e.message || "Error al asignar"),
  });

  if (!user?.isPlatformAdmin) {
    return (
      <div className="p-6 max-w-lg">
        <p className="text-slate-600">No tenés permisos de administrador de plataforma.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Administración</h1>
        <p className="text-sm text-slate-600 mt-1">
          Crear equipos y asignar usuarios (alta de cuentas vía Supabase o invitación por email).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Equipos</CardTitle>
          <CardDescription>Workspaces registrados en el CRM</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingWs ? (
            <p className="text-sm text-slate-500">Cargando…</p>
          ) : workspaces.length === 0 ? (
            <p className="text-sm text-slate-500">Todavía no hay equipos.</p>
          ) : (
            <ul className="text-sm space-y-2">
              {workspaces.map((w) => (
                <li key={w.id} className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="font-medium">{w.name}</span>
                  <span className="text-slate-500 font-mono text-xs">{w.id}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nuevo equipo</CardTitle>
          <CardDescription>
            El dueño debe ser un usuario ya existente (perfil en el sistema). Si no hay usuarios sin
            equipo, creá uno en Supabase Auth o invitá por email desde un equipo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre del equipo</Label>
            <Input value={newWsName} onChange={(e) => setNewWsName(e.target.value)} placeholder="Ej. Inmobiliaria Norte" />
          </div>
          <div className="space-y-2">
            <Label>Dueño (usuario sin equipo)</Label>
            <Select value={ownerId || undefined} onValueChange={setOwnerId}>
              <SelectTrigger>
                <SelectValue placeholder={loadingUsers ? "Cargando…" : "Elegí usuario"} />
              </SelectTrigger>
              <SelectContent>
                {sinEquipo.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name || p.email || p.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            disabled={!newWsName.trim() || !ownerId || createWsMutation.isPending}
            onClick={() =>
              createWsMutation.mutate({ name: newWsName.trim(), owner_user_id: ownerId })
            }
          >
            Crear equipo
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Asignar usuario a un equipo</CardTitle>
          <CardDescription>
            Para usuarios que ya existen y aún no tienen ningún equipo (o para sumarlos a otro equipo).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Equipo</Label>
            <Select value={addWsId || undefined} onValueChange={setAddWsId}>
              <SelectTrigger>
                <SelectValue placeholder="Elegí equipo" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Usuario</Label>
            <Select value={addUserId || undefined} onValueChange={setAddUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Elegí usuario" />
              </SelectTrigger>
              <SelectContent>
                {sinEquipo.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name || p.email || p.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Rol</Label>
            <Select value={addRole} onValueChange={setAddRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Miembro</SelectItem>
                <SelectItem value="admin">Administrador del equipo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            disabled={!addWsId || !addUserId || addMemberMutation.isPending}
            onClick={() =>
              addMemberMutation.mutate({
                workspace_id: addWsId,
                user_id: addUserId,
                role: addRole,
              })
            }
          >
            Asignar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
