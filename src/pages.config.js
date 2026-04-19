import Administracion from './pages/Administracion';
import Ajustes from './pages/Ajustes';
import Configuracion from './pages/Configuracion';
import ConfigurarPipeline from './pages/ConfigurarPipeline';
import Consultas from './pages/Consultas';
import Contactos from './pages/Contactos';
import Dashboard from './pages/Dashboard';
import EditorListaWhatsApp from './pages/EditorListaWhatsApp';
import ExportarVentas from './pages/ExportarVentas';
import GoogleCalendarConfig from './pages/GoogleCalendarConfig';
import Home from './pages/Home';
import Hoy from './pages/Hoy';
import ListasWhatsApp from './pages/ListasWhatsApp';
import MiembrosWorkspace from './pages/MiembrosWorkspace';
import Operaciones from './pages/Operaciones';
import Pipeline from './pages/Pipeline';
import Plantillas from './pages/Plantillas';
import Postventa from './pages/Postventa';
import PropietarioDetalle from './pages/PropietarioDetalle';
import Propiedades from './pages/Propiedades';
import Propietarios from './pages/Propietarios';
import Reportes from './pages/Reportes';
import Variables from './pages/Variables';
import VentaDetalle from './pages/VentaDetalle';
import VentasDashboard from './pages/VentasDashboard';
import __Layout from './Layout.jsx';

export const PAGES = {
    "Administracion": Administracion,
    "Ajustes": Ajustes,
    "Configuracion": Configuracion,
    "ConfigurarPipeline": ConfigurarPipeline,
    "Consultas": Consultas,
    "Contactos": Contactos,
    "Dashboard": Dashboard,
    "EditorListaWhatsApp": EditorListaWhatsApp,
    "ExportarVentas": ExportarVentas,
    "GoogleCalendarConfig": GoogleCalendarConfig,
    "Home": Home,
    "Hoy": Hoy,
    "ListasWhatsApp": ListasWhatsApp,
    "MiembrosWorkspace": MiembrosWorkspace,
    "Operaciones": Operaciones,
    "Pipeline": Pipeline,
    "Plantillas": Plantillas,
    "Postventa": Postventa,
    "PropietarioDetalle": PropietarioDetalle,
    "Propiedades": Propiedades,
    "Propietarios": Propietarios,
    "Reportes": Reportes,
    "Variables": Variables,
    "VentaDetalle": VentaDetalle,
    "VentasDashboard": VentasDashboard,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};