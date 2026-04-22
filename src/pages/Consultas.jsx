import { useState } from "react";
import { api } from "@/api/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "@/components/context/WorkspaceContext";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import {
  Plus, Search, MessageCircle, Calendar, CheckCircle2, XCircle,
  MoreHorizontal, ArrowUpDown, ArrowLeft, Trash2, ListCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import moment from "moment";
import ConsultaForm from "@/components/crm/ConsultaForm";
import WhatsAppSender from "@/components/crm/WhatsAppSender";
import DetalleConsultaDialog from "@/components/crm/DetalleConsultaDialog";
import DialogSelectorListasWhatsApp from "@/components/crm/DialogSelectorListasWhatsApp";
import OperacionForm from "@/components/ventas/OperacionForm";
import { toast } from "sonner";

const etapaColors = {
  "Nuevo lead": "bg-blue-100 text-blue-700",
  Contactado: "bg-cyan-100 text-cyan-700",
  "Visita agendada": "bg-violet-100 text-violet-700",
  "Visita realizada": "bg-amber-100 text-amber-700",
  "En negociación": "bg-orange-100 text-orange-700",
  "Reserva firmada": "bg-purple-100 text-purple-700",
  "Operación cerrada": "bg-emerald-100 text-emerald-700",
  "No concretado": "bg-slate-100 text-slate-600"
};

const prioridadColors = {
  Alta: "bg-red-50 text-red-700 border-red-200",
  Media: "bg-amber-50 text-amber-700 border-amber-200",
  Baja: "bg-slate-50 text-slate-600 border-slate-200"
};

const CANALES = [
  "Zona Prop", "MercadoLibre", "La Voz del Interior",
  "Facebook", "Instagram", "Estado WhatsApp", "Referido",
  "Cartel en propiedad", "Otro"
];

const MOTIVOS_PERDIDA = [
  "Fuera de presupuesto", "Se fue con otra inmobiliaria", "No encontró lo que buscaba",
  "Postergó decisión", "NoResponde", "Financiacion", "Otro"
];

export default function Consultas() {
  const [showForm, setShowForm] = useState(false);
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [showDetalleDialog, setShowDetalleDialog] = useState(false);
  const [showListasDialog, setShowListasDialog] = useState(false);
  const [selectedConsulta, setSelectedConsulta] = useState(null);
  const [showOperacionForm, setShowOperacionForm] = useState(false);
  const [consultaParaOperacion, setConsultaParaOperacion] = useState(null);
  const [search, setSearch] = useState("");
  const [filtroEtapa, setFiltroEtapa] = useState("todas");
  const [filtroCanal, setFiltroCanal] = useState("todos");
  const [filtroPrioridad, setFiltroPrioridad] = useState("todas");
  const [sortField, setSortField] = useState("created_date");
  const [sortOrder, setSortOrder] = useState("desc");

  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

  const { data: consultas = [], refetch, isLoading } = useQuery({
    queryKey: ['consultas-list', workspace?.id],
    queryFn: () => workspace ? api.entities.Consulta.filter({ workspace_id: workspace.id }, "-created_date", 2000) : [],
    enabled: !!workspace
  });

  const { data: etapasPipeline = [] } = useQuery({
    queryKey: ['pipeline-stages', workspace?.id],
    queryFn: async () => {
      if (!workspace) return [];
      const stages = await api.entities.PipelineStage.filter({ workspace_id: workspace.id }, "orden", 100);
      return stages.filter(s => s.activa !== false);
    },
    enabled: !!workspace
  });

  const { data: tags = [] } = useQuery({
    queryKey: ['tags', workspace?.id],
    queryFn: () => workspace ? api.entities.Tag.filter({ workspace_id: workspace.id }) : [],
    enabled: !!workspace
  });

  const canalesDinamicos = tags.filter(t => t.type === 'source').map(t => t.name);
  const canalesList = canalesDinamicos.length > 0 ? canalesDinamicos : CANALES;

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.Consulta.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['consultas-list', workspace?.id] })
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.entities.Consulta.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultas-list', workspace?.id] });
      toast.success("Consulta eliminada");
    }
  });

  const consultasFiltradas = consultas
    .filter(c => {
      if (search) {
        const s = search.toLowerCase();
        if (!c.contactoNombre?.toLowerCase().includes(s) &&
            !c.contactoWhatsapp?.includes(search) &&
            !c.propiedadConsultada?.toLowerCase().includes(s) &&
            !(c.productoConsultado?.toLowerCase().includes(s))) {
          return false;
        }
      }
      if (filtroEtapa !== "todas" && c.etapa !== filtroEtapa) return false;
      if (filtroCanal !== "todos" && c.canalOrigen !== filtroCanal) return false;
      if (filtroPrioridad !== "todas" && c.prioridad !== filtroPrioridad) return false;
      return true;
    })
    .sort((a, b) => {
      let valA = a[sortField], valB = b[sortField];
      if (sortField === "precioCotizado") { valA = valA || 0; valB = valB || 0; }
      return sortOrder === "desc" ? (valA > valB ? -1 : 1) : (valA < valB ? -1 : 1);
    });

  const handleWhatsApp = (c) => { setSelectedConsulta(c); setShowWhatsApp(true); };

  const handleRegistrarOperacion = async (consulta) => {
    const ops = await api.entities.Venta.filter({ consultaId: consulta.id });
    if (ops.length > 0) {
      window.location.href = createPageUrl(`VentaDetalle?id=${ops[0].id}`);
      return;
    }
    setConsultaParaOperacion(consulta);
    setShowOperacionForm(true);
  };

  const handleMarcarNoConcretado = async (consulta, motivo) => {
    await updateMutation.mutateAsync({ id: consulta.id, data: { etapa: "No concretado", motivoPerdida: motivo } });
    toast.success("Marcado como no concretado");
  };

  const handleSeguimiento = async (consulta, dias) => {
    const fecha = moment().add(dias, 'days').format("YYYY-MM-DD");
    await updateMutation.mutateAsync({ id: consulta.id, data: { proximoSeguimiento: fecha } });
    toast.success(`Seguimiento agendado para ${moment(fecha).format("DD/MM")}`);
  };

  const toggleSort = (field) => {
    if (sortField === field) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortOrder("desc"); }
  };

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="bg-white border-b border-slate-100 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <Link to={createPageUrl("Home")}>
                <Button variant="ghost" className="gap-2 mb-2 -ml-2">
                  <ArrowLeft className="w-4 h-4" />Volver
                </Button>
              </Link>
              <h1 className="text-2xl font-bold text-slate-900">Consultas / Leads</h1>
              <p className="text-slate-500">{consultasFiltradas.length} resultados</p>
            </div>
            <Button onClick={() => { setSelectedConsulta(null); setShowForm(true); }} className="gap-2">
              <Plus className="w-4 h-4" />
              Nueva consulta / lead
            </Button>
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input placeholder="Buscar por nombre, teléfono o búsqueda..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={filtroEtapa} onValueChange={setFiltroEtapa}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Etapa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las etapas</SelectItem>
                {etapasPipeline.length > 0
                  ? etapasPipeline.map(e => <SelectItem key={e.nombre} value={e.nombre}>{e.nombre}</SelectItem>)
                  : Object.keys(etapaColors).map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)
                }
              </SelectContent>
            </Select>
            <Select value={filtroCanal} onValueChange={setFiltroCanal}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Canal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los canales</SelectItem>
                {canalesList.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtroPrioridad} onValueChange={setFiltroPrioridad}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Prioridad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="Alta">Alta</SelectItem>
                <SelectItem value="Media">Media</SelectItem>
                <SelectItem value="Baja">Baja</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="max-w-7xl mx-auto bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50">
                <TableHead className="font-semibold">Contacto</TableHead>
                <TableHead className="font-semibold">Búsqueda</TableHead>
                <TableHead className="font-semibold cursor-pointer hover:bg-slate-100" onClick={() => toggleSort("precioCotizado")}>
                  <div className="flex items-center gap-1">Precio<ArrowUpDown className="w-3 h-3" /></div>
                </TableHead>
                <TableHead className="font-semibold">Etapa</TableHead>
                <TableHead className="font-semibold">Seguimiento</TableHead>
                <TableHead className="font-semibold text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && [1,2,3,4,5].map(i => (
                <TableRow key={i}>
                  {[1,2,3,4,5,6].map(j => (
                    <TableCell key={j}><div className="h-4 bg-slate-100 rounded animate-pulse" /></TableCell>
                  ))}
                </TableRow>
              ))}
              {!isLoading && consultasFiltradas.map(consulta => {
                const vencido = consulta.proximoSeguimiento && moment(consulta.proximoSeguimiento).isBefore(moment(), 'day');
                const busqueda = consulta.propiedadConsultada || consulta.productoConsultado;
                const tipo = consulta.tipoPropiedad || consulta.categoriaProducto;

                return (
                  <TableRow key={consulta.id} className="cursor-pointer hover:bg-slate-50"
                    onClick={() => { setSelectedConsulta(consulta); setShowDetalleDialog(true); }}>
                    <TableCell>
                      <p className="font-medium text-slate-900">{consulta.contactoNombre}</p>
                      <p className="text-sm text-slate-500">{consulta.contactoWhatsapp}</p>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {consulta.canalOrigen && <Badge variant="secondary" className="text-xs">{consulta.canalOrigen}</Badge>}
                        <Badge variant="outline" className={cn("text-xs", prioridadColors[consulta.prioridad])}>{consulta.prioridad}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-sm leading-snug">{busqueda}</p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {tipo && <Badge variant="secondary" className="text-xs">{tipo}</Badge>}
                        {consulta.operacionBuscada && <Badge variant="outline" className="text-xs">{consulta.operacionBuscada}</Badge>}
                        {consulta.barrio && <span className="text-xs text-slate-500">📍 {consulta.barrio}</span>}
                      </div>
                      {Array.isArray(consulta.caracteristicas) && consulta.caracteristicas.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {consulta.caracteristicas.slice(0, 3).map(c => (
                            <span key={c} className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">{c}</span>
                          ))}
                          {consulta.caracteristicas.length > 3 && (
                            <span className="text-xs text-slate-400">+{consulta.caracteristicas.length - 3}</span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {consulta.precioCotizado ? (
                        <p className="font-bold">{consulta.moneda === "USD" ? "US$" : "$"} {consulta.precioCotizado.toLocaleString()}</p>
                      ) : <span className="text-slate-400">-</span>}
                    </TableCell>
                    <TableCell>
                      <Badge className={etapaColors[consulta.etapa] || "bg-slate-100 text-slate-600"}>{consulta.etapa}</Badge>
                    </TableCell>
                    <TableCell>
                      {consulta.proximoSeguimiento ? (
                        <div className={cn("flex items-center gap-1 text-sm", vencido ? "text-red-600" : "text-slate-600")}>
                          <Calendar className="w-3.5 h-3.5" />
                          {moment(consulta.proximoSeguimiento).format("DD/MM")}
                          {vencido && <span className="text-xs">(vencido)</span>}
                        </div>
                      ) : <span className="text-slate-400">-</span>}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" onClick={() => handleWhatsApp(consulta)}
                          className="bg-[#25D366] hover:bg-[#20bd5a] text-white h-8 w-8 p-0">
                          <MessageCircle className="w-4 h-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setSelectedConsulta(consulta); setShowListasDialog(true); }}>
                              <ListCheck className="w-4 h-4 mr-2" />Enviar Lista WhatsApp
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleSeguimiento(consulta, 1)}>
                              <Calendar className="w-4 h-4 mr-2" />Seguimiento mañana
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleSeguimiento(consulta, 3)}>
                              <Calendar className="w-4 h-4 mr-2" />Seguimiento en 3 días
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleSeguimiento(consulta, 7)}>
                              <Calendar className="w-4 h-4 mr-2" />Seguimiento en 1 semana
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleRegistrarOperacion(consulta)} className="text-emerald-600">
                              <CheckCircle2 className="w-4 h-4 mr-2" />Registrar operación
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {MOTIVOS_PERDIDA.map(motivo => (
                              <DropdownMenuItem key={motivo} onClick={() => handleMarcarNoConcretado(consulta, motivo)} className="text-red-600">
                                <XCircle className="w-4 h-4 mr-2" />No concretado — {motivo}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => { if (window.confirm("¿Eliminar esta consulta?")) deleteMutation.mutate(consulta.id); }} className="text-red-600">
                              <Trash2 className="w-4 h-4 mr-2" />Eliminar consulta
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!isLoading && consultasFiltradas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-slate-400">
                    No hay consultas que coincidan con los filtros
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <ConsultaForm open={showForm} onOpenChange={setShowForm} consulta={selectedConsulta}
        onSave={() => { refetch(); setSelectedConsulta(null); }} />

      <WhatsAppSender open={showWhatsApp} onOpenChange={setShowWhatsApp}
        consulta={selectedConsulta} onMessageSent={refetch} />

      <DetalleConsultaDialog consulta={selectedConsulta} open={showDetalleDialog}
        onOpenChange={setShowDetalleDialog} onSave={refetch} />

      <DialogSelectorListasWhatsApp open={showListasDialog} onOpenChange={setShowListasDialog}
        contactoId={selectedConsulta?.contactoId}
        contactoWhatsapp={selectedConsulta?.contactoWhatsapp}
        consultaId={selectedConsulta?.id}
        onMessageSent={refetch} />

      <OperacionForm
        open={showOperacionForm}
        onOpenChange={setShowOperacionForm}
        consulta={consultaParaOperacion}
        onOperacionCreada={async () => {
          await updateMutation.mutateAsync({
            id: consultaParaOperacion.id,
            data: { concretado: true, etapa: "Operación cerrada" }
          });
          setShowOperacionForm(false);
          setConsultaParaOperacion(null);
          toast.success("¡Operación registrada!");
        }}
      />
    </div>
  );
}