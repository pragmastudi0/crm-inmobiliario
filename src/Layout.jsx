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
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 shrink-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 max-w-[1600px] mx-auto">
        <div className="flex items-start gap-2 min-w-0">
          <CalendarSync className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="font-medium text-amber-900">Google Calendar desconectado</p>
            <p className="text-sm text-amber-800">
              La sincronización de seguimientos no funcionará hasta que reconectes tu cuenta.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button asChild size="sm" variant="default">
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
    <div className="min-h-screen bg-slate-50">
      {/* Mobile Header */}
      <header className="lg:hidden bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <span className="font-bold text-slate-900">PRAGMA CRM INMO</span>
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full bg-white border-r border-slate-100 z-50 transition-all duration-300 flex flex-col",
          sidebarCollapsed ? "lg:w-16" : "lg:w-64",
          sidebarOpen ? "translate-x-0 w-64" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div
          className={cn(
            "p-4 flex items-center border-b border-slate-100",
            sidebarCollapsed ? "justify-center" : "justify-between"
          )}
        >
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">P</span>
              </div>
              <span className="font-bold text-slate-900">PRAGMA CRM</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:flex"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              {sidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          {navItems.map((item) => {
            const isActive = currentPageName === item.page;
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                onClick={() => setSidebarOpen(false)}
                title={sidebarCollapsed ? item.name : undefined}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                  sidebarCollapsed ? "justify-center" : "",
                  isActive
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!sidebarCollapsed && item.name}
              </Link>
            );
          })}
        </nav>

        {!sidebarCollapsed && (
          <div className="p-4 border-t border-slate-100">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-4 text-white">
              <p className="text-xs text-slate-400 mb-1">Mini CRM</p>
              <p className="text-sm font-medium">Seguimiento de ventas</p>
              <p className="text-xs text-slate-400 mt-2">PRAGMA CRM INMO</p>
            </div>
          </div>
        )}
      </aside>

      <main className={cn("transition-all duration-300", sidebarCollapsed ? "lg:ml-16" : "lg:ml-64")}>
        <GoogleCalendarDisconnectBanner />
        {children}
      </main>
      <Button
        variant="secondary"
        className={cn(
          "fixed bottom-4 z-40 gap-2",
          "left-4 lg:left-20",
          !sidebarCollapsed && "lg:left-[17rem]"
        )}
        onClick={() => logout(true)}
      >
        <LogOut className="w-4 h-4" />
        Cerrar sesión
      </Button>
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
