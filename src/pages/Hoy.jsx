import { useState } from "react";
import { api } from "@/api/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, AlertCircle, CheckCircle2, MessageCircle, ArrowLeft, Star, XCircle } from "lucide-react";
import { useWorkspace } from "@/components/context/WorkspaceContext";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import moment from "moment";
import WhatsAppSender from "@/components/crm/WhatsAppSender";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

const etapaColors = {
  Nuevo: "bg-blue-100 text-blue-700",
  Respondido: "bg-cyan-100 text-cyan-700",
  Seguimiento1: "bg-amber-100 text-amber-700",
  Seguimiento2: "bg-orange-100 text-orange-700",
  Negociacion: "bg-purple-100 text-purple-700",
};

export default function Hoy() {
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [selectedConsulta, setSelectedConsulta] = useState(null);
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

  const { data: consultas = [], refetch } = useQuery({
    queryKey: ['consultas-hoy', workspace?.id],
    queryFn: () => workspace ? api.entities.Consulta.filter({ workspace_id: workspace.id }, "-created_date", 1000) : [],
    enabled: !!workspace
  });

  const { data: ventas = [] } = useQuery({
    queryKey: ['ventas-postventa-hoy', workspace?.id],
    queryFn: () => workspace ? api.entities.Venta.filter({ workspace_id: workspace.id, postventaActiva: true }, "-created_date", 500) : [],
    enabled: !!workspace
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.Consulta.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultas-hoy', workspace?.id] });
      toast.success("Actualizado");
    }
  });

  const updateVentaMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.Venta.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ventas-postventa-hoy', workspace?.id] });
      toast.success("Postventa actualizada");
    }
  });

  const today = moment();

  const hoy = consultas.filter(c => 
    c.proximoSeguimiento && 
    moment(c.proximoSeguimiento).isSame(today, 'day') &&
    !c.concretado && c.etapa !== "No concretado" && c.etapa !== "Perdido"
  );

  const vencidos = consultas.filter(c => 
    c.proximoSeguimiento && 
    moment(c.proximoSeguimiento).isBefore(today, 'day') &&
    !c.concretado && c.etapa !== "No concretado" && c.etapa !== "Perdido"
  );

  const proximos3d = consultas.filter(c => 
    c.proximoSeguimiento && 
    moment(c.proximoSeguimiento).isAfter(today, 'day') &&
    moment(c.proximoSeguimiento).isBefore(today.clone().add(3, 'days'), 'day') &&
    !c.concretado && c.etapa !== "No concretado" && c.etapa !== "Perdido"
  );

  // Postventa
  const postventaHoy = ventas.filter(v =>
    v.proximoSeguimientoPostventa &&
    moment(v.proximoSeguimientoPostventa).isSame(today, 'day') &&
    v.postventaEstado !== "Cerrado"
  );

  const postventaVencidos = ventas.filter(v =>
    v.proximoSeguimientoPostventa &&
    moment(v.proximoSeguimientoPostventa).isBefore(today, 'day') &&
    v.postventaEstado !== "Cerrado"
  );

  const postventaProximos = ventas.filter(v =>
    v.proximoSeguimientoPostventa &&
    moment(v.proximoSeguimientoPostventa).isAfter(today, 'day') &&
    moment(v.proximoSeguimientoPostventa).isBefore(today.clone().add(3, 'days'), 'day') &&
    v.postventaEstado !== "Cerrado"
  );

  const handleWhatsApp = (consulta) => {
    setSelectedConsulta(consulta);
    setShowWhatsApp(true);
  };

  const handleSeguimiento = async (consulta, dias) => {
    const fecha = moment().add(dias, 'days').format("YYYY-MM-DD");
    await updateMutation.mutateAsync({
      id: consulta.id,
      data: { proximoSeguimiento: fecha }
    });
    toast.success(`Seguimiento agendado para ${moment(fecha).format("DD/MM")}`);
  };

  const handleMarcarPerdido = async (consulta, motivo) => {
    await updateMutation.mutateAsync({
      id: consulta.id,
      data: { etapa: "No concretado", motivoPerdida: motivo }
    });
    toast.success("Marcado como no concretado");
  };

  const handleMarcarPostventaCompletado = async (venta) => {
    const nuevaFecha = moment().add(7, 'days').format("YYYY-MM-DD");
    await updateVentaMutation.mutateAsync({
      id: venta.id,
      data: { proximoSeguimientoPostventa: nuevaFecha, postventaEstado: "Enviado", postventaUltimoContacto: new Date().toISOString() }
    });
  };

  const ConsultaItem = ({ consulta, tipo }) => (
    <Card className="hover:shadow-md transition-all">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-slate-900">{consulta.contactoNombre}</h3>
              <Badge className={etapaColors[consulta.etapa]}>
                {consulta.etapa}
              </Badge>
            </div>
            <p className="text-sm text-slate-600 mb-1">{consulta.propiedadConsultada || consulta.productoConsultado}</p>
            {(consulta.caracteristicas || consulta.variante) && (
              <p className="text-xs text-slate-400">{consulta.caracteristicas || consulta.variante}</p>
            )}
            {consulta.precioCotizado && (
              <p className="text-sm font-medium text-slate-900 mt-2">
                {consulta.moneda === "USD" ? "US$" : "$"} {consulta.precioCotizado.toLocaleString()}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <Calendar className="w-3 h-3 text-slate-400" />
              <span className={`text-xs ${
                tipo === "vencido" ? "text-red-600 font-medium" : "text-slate-500"
              }`}>
                {moment(consulta.proximoSeguimiento).format("DD/MM/YYYY")}
                {tipo === "vencido" && " (vencido)"}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2 ml-4">
            <Button
              size="sm"
              onClick={() => handleWhatsApp(consulta)}
              className="bg-[#25D366] hover:bg-[#20bd5a] text-white"
            >
              <MessageCircle className="w-4 h-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <CheckCircle2 className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleSeguimiento(consulta, 1)}>Mañana</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSeguimiento(consulta, 3)}>En 3 días</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSeguimiento(consulta, 7)}>En 1 semana</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="border-red-200 text-red-500 hover:bg-red-50">
                  <XCircle className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="text-red-600" onClick={() => handleMarcarPerdido(consulta, "Fuera de presupuesto")}>Fuera de presupuesto</DropdownMenuItem>
                <DropdownMenuItem className="text-red-600" onClick={() => handleMarcarPerdido(consulta, "Se fue con otra inmobiliaria")}>Se fue con otra inmobiliaria</DropdownMenuItem>
                <DropdownMenuItem className="text-red-600" onClick={() => handleMarcarPerdido(consulta, "No encontró lo que buscaba")}>No encontró lo que buscaba</DropdownMenuItem>
                <DropdownMenuItem className="text-red-600" onClick={() => handleMarcarPerdido(consulta, "Postergó decisión")}>Postergó decisión</DropdownMenuItem>
                <DropdownMenuItem className="text-red-600" onClick={() => handleMarcarPerdido(consulta, "NoResponde")}>No responde</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const PostventaItem = ({ venta, tipo }) => (
    <Card className="hover:shadow-md transition-all border-l-4 border-l-emerald-400">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-4 h-4 text-emerald-500" />
              <h3 className="font-semibold text-slate-900">{venta.nombreSnapshot} {venta.apellidoSnapshot}</h3>
              <Badge className="bg-emerald-100 text-emerald-700">Post-operación</Badge>
            </div>
            <p className="text-sm text-slate-600 mb-1">{venta.propiedadDescripcion || venta.productoSnapshot || venta.modelo}</p>
            {venta.postventaNotas && (
              <p className="text-xs text-slate-400">{venta.postventaNotas}</p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <Calendar className="w-3 h-3 text-slate-400" />
              <span className={`text-xs ${tipo === "vencido" ? "text-red-600 font-medium" : "text-slate-500"}`}>
                {moment(venta.proximoSeguimientoPostventa).format("DD/MM/YYYY")}
                {tipo === "vencido" && " (vencido)"}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2 ml-4">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleMarcarPostventaCompletado(venta)}
            >
              <CheckCircle2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-slate-50/50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link to={createPageUrl("Home")}>
              <Button variant="ghost" className="gap-2 mb-2 -ml-2">
                <ArrowLeft className="w-4 h-4" />
                Volver
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">Seguimientos del Día</h1>
            <p className="text-slate-500 mt-1">
              {today.format("dddd, DD [de] MMMM [de] YYYY")}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Hoy</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{hoy.length + postventaHoy.length}</p>
              {postventaHoy.length > 0 && <p className="text-xs text-emerald-600 mt-1">{postventaHoy.length} postventa</p>}
            </CardContent>
          </Card>
          <Card className="border-red-200 bg-red-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-600">Vencidos</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-red-600">{vencidos.length + postventaVencidos.length}</p>
              {postventaVencidos.length > 0 && <p className="text-xs text-red-500 mt-1">{postventaVencidos.length} postventa</p>}
            </CardContent>
          </Card>
          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-600">Próximos 3 días</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-600">{proximos3d.length + postventaProximos.length}</p>
              {postventaProximos.length > 0 && <p className="text-xs text-blue-500 mt-1">{postventaProximos.length} postventa</p>}
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue={vencidos.length > 0 ? "vencidos" : "hoy"}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="vencidos" className="gap-2">
              <AlertCircle className="w-4 h-4" />
              Vencidos ({vencidos.length + postventaVencidos.length})
            </TabsTrigger>
            <TabsTrigger value="hoy" className="gap-2">
              <Calendar className="w-4 h-4" />
              Hoy ({hoy.length + postventaHoy.length})
            </TabsTrigger>
            <TabsTrigger value="proximos" className="gap-2">
              Próximos ({proximos3d.length + postventaProximos.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="vencidos" className="space-y-3 mt-4">
            {vencidos.map(c => <ConsultaItem key={c.id} consulta={c} tipo="vencido" />)}
            {postventaVencidos.map(v => <PostventaItem key={v.id} venta={v} tipo="vencido" />)}
            {vencidos.length === 0 && postventaVencidos.length === 0 && (
              <Card>
                <CardContent className="text-center py-12">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                  <p className="text-slate-500">¡Excelente! No hay seguimientos vencidos</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="hoy" className="space-y-3 mt-4">
            {hoy.map(c => <ConsultaItem key={c.id} consulta={c} tipo="hoy" />)}
            {postventaHoy.map(v => <PostventaItem key={v.id} venta={v} tipo="hoy" />)}
            {hoy.length === 0 && postventaHoy.length === 0 && (
              <Card>
                <CardContent className="text-center py-12">
                  <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No hay seguimientos programados para hoy</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="proximos" className="space-y-3 mt-4">
            {proximos3d.map(c => <ConsultaItem key={c.id} consulta={c} tipo="proximo" />)}
            {postventaProximos.map(v => <PostventaItem key={v.id} venta={v} tipo="proximo" />)}
            {proximos3d.length === 0 && postventaProximos.length === 0 && (
              <Card>
                <CardContent className="text-center py-12">
                  <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No hay seguimientos en los próximos 3 días</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <WhatsAppSender
        open={showWhatsApp}
        onOpenChange={setShowWhatsApp}
        consulta={selectedConsulta}
        onMessageSent={refetch}
      />
    </div>
  );
}