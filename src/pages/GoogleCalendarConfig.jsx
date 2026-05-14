import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, CalendarSync, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";
import {
  isConnected,
  getConnectedEmail,
  connect,
  disconnect,
  getClientId,
  isGoogleCalendarConnected,
} from "@/lib/googleCalendar";
import { supabase } from "@/api/supabaseClient";
import { CRM_APP_SLUG, TBL } from "@/api/entityApi";
import { useAuth } from "@/lib/AuthContext";
import { useWorkspace } from "@/components/context/WorkspaceContext";

export default function GoogleCalendarConfig() {
  const { user, refreshProfile } = useAuth();
  const { refetchWorkspace } = useWorkspace();
  const [connected, setConnected] = useState(false);
  const [email, setEmail] = useState("");
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    setConnected(isGoogleCalendarConnected());
    setEmail(user?.googleCalendarEmail || getConnectedEmail() || "");
  }, [user?.googleCalendarEmail]);

  const persistProfileCalendar = async (googleEmail) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return;
    const emailToStore = googleEmail || session.user.email || null;
    const { error } = await supabase
      .from(TBL.profiles)
      .update({
        google_calendar_email: emailToStore,
        google_calendar_linked_at: new Date().toISOString(),
      })
      .eq("id", session.user.id)
      .eq("app_slug", CRM_APP_SLUG);
    if (error) throw error;
  };

  const clearProfileCalendar = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return;
    const { error } = await supabase
      .from(TBL.profiles)
      .update({
        google_calendar_email: null,
        google_calendar_linked_at: null,
      })
      .eq("id", session.user.id)
      .eq("app_slug", CRM_APP_SLUG);
    if (error) throw error;
  };

  const handleConnect = async () => {
    if (!getClientId()) {
      toast.error("La aplicación no tiene configurado el Client ID de Google");
      return;
    }
    setConnecting(true);
    try {
      const result = await connect();
      await persistProfileCalendar(result.email);
      await refreshProfile();
      await refetchWorkspace?.();
      setConnected(true);
      setEmail(result.email || user?.googleCalendarEmail || getConnectedEmail() || "");
      toast.success("Conectado a Google Calendar");
    } catch (err) {
      toast.error(err.message || "Error al conectar con Google");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      disconnect();
      await clearProfileCalendar();
      await refreshProfile();
      await refetchWorkspace?.();
      setConnected(false);
      setEmail("");
      toast.success("Desconectado de Google Calendar");
    } catch (err) {
      toast.error(err.message || "Error al desconectar");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <Link to={createPageUrl("Ajustes")}>
            <Button variant="ghost" className="gap-2 mb-2 -ml-2">
              <ArrowLeft className="w-4 h-4" />
              Volver a Ajustes
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Google Calendar</h1>
          <p className="text-slate-500 mt-1">
            Sincronizá tus seguimientos de leads con Google Calendar
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarSync className="w-5 h-5" />
              Estado de conexión
            </CardTitle>
            <CardDescription>
              Conectá tu cuenta de Google para crear eventos de seguimiento automáticamente. La sesión se
              renueva en segundo plano cuando es posible. Si actualizamos permisos, volvé a conectar una vez
              para incluir el email de la cuenta de Google.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {connected ? (
              <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-900">Conectado</p>
                    {email && <p className="text-sm text-green-700">{email}</p>}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleDisconnect}>
                  Desconectar
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <XCircle className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="font-medium text-slate-700">No conectado</p>
                    <p className="text-sm text-slate-500">
                      Conectá tu cuenta de Google para sincronizar
                      {(user?.googleCalendarEmail || user?.googleCalendarLinkedAt) &&
                        " (tu cuenta quedó registrada; si ya autorizaste antes, podés volver a conectar)."}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleConnect}
                  disabled={connecting || !getClientId()}
                  className="gap-2"
                >
                  {connecting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Conectar con Google
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>¿Cómo funciona?</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-sm text-slate-600">
              <li>Hacé clic en &quot;Conectar con Google&quot; y autorizá el acceso</li>
              <li>
                Al crear una nueva consulta / lead, marcá la opción &quot;Sincronizar con Google
                Calendar&quot;
              </li>
              <li>
                Se creará automáticamente un evento en tu Google Calendar con la fecha de seguimiento
                del lead
              </li>
            </ol>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-slate-400 py-4">PRAGMA CRM - Rubro Inmobiliario</div>
      </div>
    </div>
  );
}
