import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  LayoutDashboard,
  Kanban,
  List,
  Users,
  Calendar,
  Menu,
  X,
  CheckCircle2,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Home,
  Shield,
  LogOut,
  CalendarSync,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { WorkspaceProvider, useWorkspace } from "@/components/context/WorkspaceContext";

const NAV_ITEMS = [
  { name: "Home", icon: Home, page: "Home" },
  { name: "Pipeline", icon: Kanban, page: "Pipeline" },
  { name: "Hoy", icon: Calendar, page: "Hoy" },
  { name: "Consultas / Leads", icon: List, page: "Consultas" },
  { name: "Clientes", icon: Users, page: "Contactos" },
  { name: "Propietarios", icon: Users, page: "Propietarios" },
  { name: "Operaciones", icon: LayoutDashboard, page: "Operaciones" },
  { name: "Post-operación", icon: CheckCircle2, page: "Postventa" },
  { name: "Ajustes", icon: Settings, page: "Ajustes" },
];

function GoogleCalendarDisconnectBanner() {
  const { showGoogleCalendarDisconnectedAlert, dismissGoogleCalendarBanner } = useWorkspace();
  if (!showGoogleCalendarDisconnectedAlert) return null;
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-3 py-3 sm:px-4 shrink-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 max-w-[1600px] mx-auto w-full min-w-0">
        <div className="flex items-start gap-2 min-w-0">
          <CalendarSync className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="font-medium text-amber-900">Google Calendar desconectado</p>
            <p className="text-sm text-amber-800 break-words">
              La sincronización de seguimientos no funcionará hasta que reconectes tu cuenta.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0 sm:justify-end">
          <Button asChild size="sm" variant="default" className="w-full sm:w-auto">
            <Link to={createPageUrl("GoogleCalendarConfig")}>Reconectar</Link>
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="text-amber-900 shrink-0"
            onClick={dismissGoogleCalendarBanner}
            aria-label="Cerrar aviso"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function LayoutInner({ children, currentPageName }) {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const navItems = user?.isPlatformAdmin
    ? [{ name: "Administración", icon: Shield, page: "Administracion" }]
    : NAV_ITEMS;

  return (
    <div className="min-h-screen min-h-[100dvh] bg-slate-50 flex flex-col">
      {/* Mobile Header */}
      <header className="lg:hidden bg-white border-b border-slate-100 px-3 sm:px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] flex items-center justify-between gap-2 sticky top-0 z-40 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 touch-manipulation"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <span className="font-bold text-slate-900 truncate text-sm sm:text-base">PRAGMA CRM INMO</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 text-slate-600 touch-manipulation"
          onClick={() => logout(true)}
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
        >
          <LogOut className="w-5 h-5" />
        </Button>
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full max-h-[100dvh] bg-white border-r border-slate-100 z-50 transition-all duration-300 flex flex-col shadow-sm lg:shadow-none",
          sidebarCollapsed ? "lg:w-16" : "lg:w-64",
          sidebarOpen ? "translate-x-0 w-[min(100vw,16rem)] max-w-[100vw]" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div
          className={cn(
            "p-3 sm:p-4 flex items-center border-b border-slate-100 shrink-0",
            sidebarCollapsed ? "lg:justify-center lg:px-2" : "justify-between"
          )}
        >
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">P</span>
              </div>
              <span className="font-bold text-slate-900 truncate">PRAGMA CRM</span>
            </div>
          )}
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:flex"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              aria-label={sidebarCollapsed ? "Expandir menú" : "Contraer menú"}
            >
              {sidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2 py-3 space-y-1 overscroll-contain">
          {navItems.map((item) => {
            const isActive = currentPageName === item.page;
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                onClick={() => setSidebarOpen(false)}
                title={sidebarCollapsed ? item.name : undefined}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all touch-manipulation",
                  sidebarCollapsed ? "lg:justify-center" : "",
                  isActive
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!sidebarCollapsed && <span className="truncate">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Pie: comprime con el panel — Card + logout; rail colapsado = solo icono (desktop) */}
        <div className="shrink-0 border-t border-slate-100 p-2 sm:p-3 mt-auto pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {sidebarCollapsed ? (
            <div className="hidden lg:flex justify-center py-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="touch-manipulation"
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
                onClick={() => logout(true)}
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 p-3 text-white">
                <p className="text-xs text-slate-400 mb-0.5">Mini CRM</p>
                <p className="text-sm font-medium leading-snug">Seguimiento de ventas</p>
                <p className="text-xs text-slate-400 mt-1.5">PRAGMA CRM INMO</p>
              </div>
              <Card className="shadow-sm border-slate-200">
                <CardContent className="p-3 flex flex-col gap-2">
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="gap-2 touch-manipulation w-full sm:w-auto"
                      onClick={() => logout(true)}
                    >
                      <LogOut className="w-4 h-4 shrink-0" />
                      Cerrar sesión
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </aside>

      <main
        className={cn(
          "flex-1 flex flex-col min-w-0 transition-[margin] duration-300",
          sidebarCollapsed ? "lg:ml-16" : "lg:ml-64"
        )}
      >
        <GoogleCalendarDisconnectBanner />
        <div className="flex-1 min-h-0 min-w-0 w-full">{children}</div>
      </main>
    </div>
  );
}

export default function Layout({ children, currentPageName }) {
  return (
    <WorkspaceProvider>
      <LayoutInner currentPageName={currentPageName}>{children}</LayoutInner>
    </WorkspaceProvider>
  );
}
