import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, CalendarSync, CheckCircle2, XCircle, Loader2, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";
import {
  isConnected,
  getConnectedEmail,
  connect,
  disconnect,
  getClientId,
  saveClientId,
} from "@/lib/googleCalendar";

export default function GoogleCalendarConfig() {
  const [connected, setConnected] = useState(false);
  const [email, setEmail] = useState("");
  const [clientId, setClientId] = useState("");
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    setConnected(isConnected());
    setEmail(getConnectedEmail());
    setClientId(getClientId());
  }, []);

  const handleSaveClientId = () => {
    if (!clientId.trim()) {
      toast.error("Ingresá un Client ID válido");
      return;
    }
    saveClientId(clientId.trim());
    toast.success("Client ID guardado");
  };

  const handleConnect = async () => {
    if (!getClientId()) {
      toast.error("Primero configurá tu Google Client ID");
      return;
    }
    setConnecting(true);
    try {
      const result = await connect();
      setConnected(true);
      setEmail(result.email);
      toast.success("Conectado a Google Calendar");
    } catch (err) {
      toast.error(err.message || "Error al conectar con Google");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setConnected(false);
    setEmail("");
    toast.success("Desconectado de Google Calendar");
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

        {/* Estado de conexión */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarSync className="w-5 h-5" />
              Estado de conexión
            </CardTitle>
            <CardDescription>
              Conectá tu cuenta de Google para crear eventos de seguimiento automáticamente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {connected ? (
              <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-900">Conectado</p>
                    {email && (
                      <p className="text-sm text-green-700">{email}</p>
                    )}
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

        {/* Configuración de Client ID */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="w-5 h-5" />
              Google Client ID
            </CardTitle>
            <CardDescription>
              Para conectar con Google Calendar necesitás un Client ID de Google Cloud Console
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="clientId">Client ID de Google OAuth 2.0</Label>
              <Input
                id="clientId"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="123456789.apps.googleusercontent.com"
              />
              <p className="text-xs text-slate-400">
                Obtené tu Client ID desde{" "}
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-blue-500 hover:text-blue-700"
                >
                  Google Cloud Console
                </a>
                . Asegurate de habilitar la API de Google Calendar.
              </p>
            </div>
            <Button onClick={handleSaveClientId} variant="outline">
              Guardar Client ID
            </Button>
          </CardContent>
        </Card>

        {/* Instrucciones */}
        <Card>
          <CardHeader>
            <CardTitle>¿Cómo funciona?</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-sm text-slate-600">
              <li>Configurá tu Google Client ID arriba</li>
              <li>Hacé clic en &quot;Conectar con Google&quot; y autorizá el acceso</li>
              <li>
                Al crear una nueva consulta / lead, marcá la opción
                &quot;Sincronizar con Google Calendar&quot;
              </li>
              <li>
                Se creará automáticamente un evento en tu Google Calendar con la fecha de
                seguimiento del lead
              </li>
            </ol>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-slate-400 py-4">
          PRAGMA CRM - Rubro Inmobiliario
        </div>
      </div>
    </div>
  );
}
