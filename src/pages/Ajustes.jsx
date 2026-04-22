import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Settings, MessageSquare, Kanban, Users, CalendarSync } from "lucide-react";

const OPCIONES = [
  {
    title: "Configuración",
    description: "Perfil, preferencias generales y moneda",
    icon: Settings,
    page: "Configuracion",
    color: "bg-slate-100 text-slate-700"
  },
  {
    title: "Miembros del Workspace",
    description: "Invitá a tu equipo y gestioná roles de acceso",
    icon: Users,
    page: "MiembrosWorkspace",
    color: "bg-violet-100 text-violet-700"
  },
  {
    title: "Plantillas WhatsApp",
    description: "Gestiona tus mensajes predefinidos y variables",
    icon: MessageSquare,
    page: "Plantillas",
    color: "bg-emerald-100 text-emerald-700"
  },
  {
    title: "Pipeline",
    description: "Configura las etapas de tu pipeline de ventas",
    icon: Kanban,
    page: "ConfigurarPipeline",
    color: "bg-blue-100 text-blue-700"
  },
  {
    title: "Listas WhatsApp",
    description: "Administrá tus listas de propiedades para enviar",
    icon: MessageSquare,
    page: "ListasWhatsApp",
    color: "bg-green-100 text-green-700"
  },
  {
    title: "Google Calendar",
    description: "Conectá tu cuenta de Google para sincronizar seguimientos con Google Calendar",
    icon: CalendarSync,
    page: "GoogleCalendarConfig",
    color: "bg-red-100 text-red-700"
  }
];

export default function Ajustes() {
  return (
    <div className="min-h-screen bg-slate-50/50 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <Link to={createPageUrl("Home")}>
            <Button variant="ghost" className="gap-2 mb-2 -ml-2">
              <ArrowLeft className="w-4 h-4" />
              Volver
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Ajustes</h1>
          <p className="text-slate-500 mt-1">Administrá la configuración de PRAGMA CRM INMO</p>
        </div>

        <div className="grid gap-4">
          {OPCIONES.map((opcion) => (
            <Link key={opcion.page} to={createPageUrl(opcion.page)}>
              <Card className="hover:shadow-md hover:border-slate-300 transition-all cursor-pointer group">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl ${opcion.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                      <opcion.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 text-lg">{opcion.title}</h3>
                      <p className="text-slate-500 text-sm mt-0.5">{opcion.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}