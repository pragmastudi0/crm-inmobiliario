import { useState, useMemo } from "react";
import { api } from "@/api/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from "recharts";
import { TrendingUp, DollarSign, Users, Home, ArrowLeft, AlertCircle, Building2 } from "lucide-react";
import { useWorkspace } from "@/components/context/WorkspaceContext";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import moment from "moment";

const COLORS = ["#3b82f6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#a855f7", "#22d3ee", "#f43f5e"];

export default function Reportes() {
  const [periodo, setPeriodo] = useState("30");
  const [filtroCanal, setFiltroCanal] = useState("todos");
  const [filtroVendedor, setFiltroVendedor] = useState("todos");
  const { workspace } = useWorkspace();

  const { data: ventas = [] } = useQuery({
    queryKey: ['ventas-reportes', workspace?.id],
    queryFn: () => workspace ? api.entities.Venta.filter({ workspace_id: workspace.id }, "-fecha", 500) : [],
    enabled: !!workspace
  });

  const { data: consultas = [] } = useQuery({
    queryKey: ['consultas-reportes', workspace?.id],
    queryFn: () => workspace ? api.entities.Consulta.filter({ workspace_id: workspace.id }, "-created_date", 1000) : [],
    enabled: !!workspace
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users-reportes', workspace?.id],
    queryFn: () => (workspace ? api.entities.User.list({ workspace_id: workspace.id }) : []),
    enabled: !!workspace,
  });

  const dias = parseInt(periodo);
  const fechaCorte = moment().subtract(dias, 'days');

  // Filtros aplicados
  const ventasFiltradas = useMemo(() => {
    let filtered = ventas.filter(v =>
      ["Escriturada", "Boleto firmado", "Finalizada", "Entregada"].includes(v.estado) &&
      moment(v.fecha).isAfter(fechaCorte)
    );
    if (filtroCanal !== "todos") filtered = filtered.filter(v =>
      v.marketplace === filtroCanal || v.canalOrigen === filtroCanal
    );
    if (filtroVendedor !== "todos") filtered = filtered.filter(v => v.porUsuarioId === filtroVendedor);
    return filtered;
  }, [ventas, fechaCorte, filtroCanal, filtroVendedor]);

  const consultasFiltradas = useMemo(() => {
    let filtered = consultas.filter(c => moment(c.created_date).isAfter(fechaCorte));
    if (filtroCanal !== "todos") filtered = filtered.filter(c => c.canalOrigen === filtroCanal);
    if (filtroVendedor !== "todos") filtered = filtered.filter(c => c.created_by === filtroVendedor);
    return filtered;
  }, [consultas, fechaCorte, filtroCanal, filtroVendedor]);

  // === DASHBOARD EJECUTIVO ===
  const totalHonorarios = ventasFiltradas.reduce((sum, v) => sum + (v.honorariosTotal || v.ganancia || 0), 0);
  const totalOperaciones = ventasFiltradas.length;
  const totalConsultas = consultasFiltradas.length;
  const tasaConversion = totalConsultas > 0 ? (totalOperaciones / totalConsultas * 100).toFixed(1) : 0;
  const precioPromedio = totalOperaciones > 0
    ? ventasFiltradas.reduce((sum, v) => sum + (v.precioOperacion || v.venta || 0), 0) / totalOperaciones
    : 0;
  const honorariosPorLead = totalConsultas > 0 ? totalHonorarios / totalConsultas : 0;

  const tiposCounts = ventasFiltradas.reduce((acc, v) => {
    const tipo = v.tipoPropiedad || v.categoriaProducto || "Sin especificar";
    acc[tipo] = (acc[tipo] || 0) + 1;
    return acc;
  }, {});
  const tipoMasOperado = Object.entries(tiposCounts).sort(([, a], [, b]) => b - a)[0];

  const canalesCounts = consultasFiltradas.reduce((acc, c) => {
    const canal = c.canalOrigen || "Sin especificar";
    acc[canal] = (acc[canal] || 0) + 1;
    return acc;
  }, {});
  const canalMasActivo = Object.entries(canalesCounts).sort(([, a], [, b]) => b - a)[0];

  // === EMBUDO ===
  const funnelData = [
    { name: "Leads", value: totalConsultas, fill: "#94a3b8" },
    { name: "Operaciones", value: totalOperaciones, fill: "#10b981" }
  ];

  // === CANALES ===
  const canalesData = useMemo(() => {
    const canales = {};
    consultasFiltradas.forEach(c => {
      const canal = c.canalOrigen || "Sin especificar";
      if (!canales[canal]) canales[canal] = { consultas: 0, operaciones: 0, honorariosTotal: 0, precioTotal: 0, tiempos: [] };
      canales[canal].consultas++;
      const operacion = ventasFiltradas.find(v => v.consultaId === c.id);
      if (operacion) {
        canales[canal].operaciones++;
        canales[canal].honorariosTotal += operacion.honorariosTotal || operacion.ganancia || 0;
        canales[canal].precioTotal += operacion.precioOperacion || operacion.venta || 0;
        const diffDias = moment(operacion.fecha).diff(moment(c.created_date), 'days');
        if (diffDias >= 0) canales[canal].tiempos.push(diffDias);
      }
    });

    return Object.entries(canales).map(([name, data]) => ({
      name,
      consultas: data.consultas,
      operaciones: data.operaciones,
      conversion: data.consultas > 0 ? (data.operaciones / data.consultas * 100).toFixed(1) : 0,
      honorariosTotal: data.honorariosTotal,
      honorariosProm: data.operaciones > 0 ? data.honorariosTotal / data.operaciones : 0,
      precioProm: data.operaciones > 0 ? data.precioTotal / data.operaciones : 0,
      tiempoProm: data.tiempos.length > 0 ? (data.tiempos.reduce((a, b) => a + b, 0) / data.tiempos.length).toFixed(0) : 0
    })).sort((a, b) => b.honorariosTotal - a.honorariosTotal);
  }, [consultasFiltradas, ventasFiltradas]);

  // === PROPIEDADES ===
  const propiedadesData = useMemo(() => {
    const tipos = {};
    ventasFiltradas.forEach(v => {
      const tipo = v.tipoPropiedad || v.categoriaProducto || "Sin especificar";
      if (!tipos[tipo]) tipos[tipo] = { honorarios: 0, precioTotal: 0, count: 0 };
      tipos[tipo].honorarios += v.honorariosTotal || v.ganancia || 0;
      tipos[tipo].precioTotal += v.precioOperacion || v.venta || 0;
      tipos[tipo].count++;
    });
    return Object.entries(tipos).map(([name, data]) => ({
      name,
      honorarios: data.honorarios,
      precioPromedio: data.count > 0 ? data.precioTotal / data.count : 0,
      count: data.count
    })).sort((a, b) => b.count - a.count);
  }, [ventasFiltradas]);

  // === AGENTES ===
  const agentesData = useMemo(() => {
    const agentes = {};
    ventasFiltradas.forEach(v => {
      const agente = v.porUsuarioId || v.agenteVendedor || "Sin asignar";
      if (!agentes[agente]) agentes[agente] = { operaciones: 0, honorarios: 0, precioTotal: 0 };
      agentes[agente].operaciones++;
      agentes[agente].honorarios += v.honorariosTotal || v.ganancia || 0;
      agentes[agente].precioTotal += v.precioOperacion || v.venta || 0;
    });
    return Object.entries(agentes).map(([userId, data]) => {
      const user = users.find(u => u.email === userId || u.id === userId);
      return {
        name: user?.full_name || userId,
        operaciones: data.operaciones,
        honorarios: data.honorarios,
        precioPromedio: data.operaciones > 0 ? data.precioTotal / data.operaciones : 0
      };
    }).sort((a, b) => b.honorarios - a.honorarios);
  }, [ventasFiltradas, users]);

  // === PÉRDIDAS ===
  const perdidasData = useMemo(() => {
    const perdidas = consultasFiltradas.filter(c => c.etapa === "Perdido" || c.etapa === "No concretado");
    const motivos = {};
    const tiempos = [];

    perdidas.forEach(c => {
      const motivo = c.motivoPerdida || "Sin especificar";
      motivos[motivo] = (motivos[motivo] || 0) + 1;
      const d = moment().diff(moment(c.created_date), 'days');
      if (d >= 0) tiempos.push(d);
    });

    const totalPerdidas = perdidas.length;
    const motivosArray = Object.entries(motivos).map(([name, count]) => ({
      name,
      value: count,
      percent: totalPerdidas > 0 ? ((count / totalPerdidas) * 100).toFixed(1) : 0
    })).sort((a, b) => b.value - a.value);

    const tiempoProm = tiempos.length > 0 ? (tiempos.reduce((a, b) => a + b, 0) / tiempos.length).toFixed(0) : 0;
    return { motivosArray, tiempoProm };
  }, [consultasFiltradas]);

  // === TIMELINE ===
  const agruparPor = dias <= 14 ? "DD/MM" : dias <= 60 ? "[Sem] WW" : "MMM YYYY";
  const operacionesTimeline = useMemo(() => {
    const groups = {};
    ventasFiltradas.forEach(v => {
      const key = moment(v.fecha).format(agruparPor);
      if (!groups[key]) groups[key] = { operaciones: 0, honorarios: 0 };
      groups[key].operaciones++;
      groups[key].honorarios += v.honorariosTotal || v.ganancia || 0;
    });

    const timeline = [];
    for (let i = dias - 1; i >= 0; i--) {
      const fecha = moment().subtract(i, 'days');
      const key = fecha.format(agruparPor);
      if (!timeline.find(t => t.periodo === key)) {
        timeline.push({
          periodo: key,
          operaciones: groups[key]?.operaciones || 0,
          honorarios: groups[key]?.honorarios || 0
        });
      }
    }
    return timeline;
  }, [ventasFiltradas, dias, agruparPor]);

  // === FILTROS DISPONIBLES ===
  const canalesDisponibles = useMemo(() => {
    return [...new Set(consultas.map(c => c.canalOrigen).filter(Boolean))].sort();
  }, [consultas]);

  const vendedoresDisponibles = useMemo(() => {
    const sellerEmails = new Set();
    ventas.forEach(v => { if (v.porUsuarioId) sellerEmails.add(v.porUsuarioId); });
    consultas.forEach(c => { if (c.created_by) sellerEmails.add(c.created_by); });
    return Array.from(sellerEmails).map(email => {
      const user = users.find(u => u.email === email);
      return { email, name: user?.full_name || email };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [ventas, consultas, users]);

  const mejorCanal = canalesData[0];
  const comparacionCanal = canalesData.length > 1 && mejorCanal
    ? `${mejorCanal.name} generó ${(mejorCanal.honorariosTotal / (canalesData[1]?.honorariosTotal || 1)).toFixed(1)}x más honorarios que ${canalesData[1]?.name}`
    : null;

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <Link to={createPageUrl("Home")}>
              <Button variant="ghost" className="gap-2 mb-2 -ml-2">
                <ArrowLeft className="w-4 h-4" />
                Volver
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">Reportes & Analytics</h1>
            <p className="text-sm text-slate-500 mt-1">Métricas accionables para tomar mejores decisiones</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 días</SelectItem>
                <SelectItem value="30">Últimos 30 días</SelectItem>
                <SelectItem value="90">Últimos 90 días</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroCanal} onValueChange={setFiltroCanal}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Canal" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los canales</SelectItem>
                {canalesDisponibles.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroVendedor} onValueChange={setFiltroVendedor}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Agente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los agentes</SelectItem>
                {vendedoresDisponibles.map(v => (
                  <SelectItem key={v.email} value={v.email}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs defaultValue="ejecutivo" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 lg:w-auto">
            <TabsTrigger value="ejecutivo">Ejecutivo</TabsTrigger>
            <TabsTrigger value="canales">Canales</TabsTrigger>
            <TabsTrigger value="propiedades">Propiedades</TabsTrigger>
            <TabsTrigger value="agentes">Agentes</TabsTrigger>
            <TabsTrigger value="perdidas">Pérdidas</TabsTrigger>
          </TabsList>

          {/* DASHBOARD EJECUTIVO */}
          <TabsContent value="ejecutivo" className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-emerald-700 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Honorarios del Período
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-emerald-900">US$ {totalHonorarios.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                  <p className="text-xs text-emerald-600 mt-1">{totalOperaciones} operaciones</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Tasa de Conversión
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-slate-900">{tasaConversion}%</p>
                  <p className="text-xs text-slate-500 mt-1">{totalOperaciones} de {totalConsultas} leads</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Precio Prom. de Operación
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-slate-900">US$ {precioPromedio.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
                    <Home className="w-4 h-4" />
                    Tipo Más Operado
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-slate-900 truncate">{tipoMasOperado?.[0] || "—"}</p>
                  {tipoMasOperado && <p className="text-xs text-slate-500 mt-1">{tipoMasOperado[1]} operaciones</p>}
                </CardContent>
              </Card>

              {canalMasActivo && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Canal Más Activo
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-bold text-slate-900">{canalMasActivo[0]}</p>
                    <p className="text-sm text-slate-600">{canalMasActivo[1]} leads</p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Embudo */}
            <Card>
              <CardHeader>
                <CardTitle>Embudo con Impacto Económico</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={funnelData} layout="vertical">
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={90} />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {funnelData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="text-center mt-4 p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-600">
                    Convertimos <span className="font-bold text-emerald-600">{tasaConversion}%</span> de los leads en operaciones.
                  </p>
                  <p className="text-sm text-slate-600 mt-1">
                    Honorarios promedio por lead: <span className="font-bold text-emerald-600">US$ {honorariosPorLead.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  </p>
                  <p className="text-sm text-slate-600 mt-1">
                    Honorarios totales: <span className="font-bold text-emerald-600">US$ {totalHonorarios.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Operaciones por Período (últimos {dias} días)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={operacionesTimeline}>
                    <XAxis dataKey="periodo" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value, name) => [value, name === "honorarios" ? "Honorarios" : "Operaciones"]} />
                    <Legend />
                    <Line type="monotone" dataKey="operaciones" stroke="#3b82f6" strokeWidth={2} name="Operaciones" />
                    <Line type="monotone" dataKey="honorarios" stroke="#10b981" strokeWidth={2} name="Honorarios" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CANALES */}
          <TabsContent value="canales" className="space-y-6">
            {comparacionCanal && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                <TrendingUp className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-blue-900">Insight</p>
                  <p className="text-sm text-blue-700">{comparacionCanal}</p>
                </div>
              </div>
            )}
            <div className="grid gap-4">
              {canalesData.map(canal => (
                <Card key={canal.name}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-slate-900">{canal.name}</h3>
                      <span className="text-2xl font-bold text-emerald-600">
                        US$ {canal.honorariosTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                      <div>
                        <p className="text-xs text-slate-500">Leads</p>
                        <p className="text-xl font-bold text-slate-900">{canal.consultas}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Operaciones</p>
                        <p className="text-xl font-bold text-slate-900">{canal.operaciones}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Conversión</p>
                        <p className="text-xl font-bold text-emerald-600">{canal.conversion}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Honorarios Prom.</p>
                        <p className="text-xl font-bold text-slate-900">US$ {canal.honorariosProm.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Tiempo Cierre</p>
                        <p className="text-xl font-bold text-slate-900">{canal.tiempoProm} días</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {canalesData.length === 0 && (
                <p className="text-center text-slate-500 py-12">No hay datos de canales para este período</p>
              )}
            </div>
          </TabsContent>

          {/* PROPIEDADES */}
          <TabsContent value="propiedades" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Operaciones por Tipo de Propiedad</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={propiedadesData} layout="vertical">
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Operaciones" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Honorarios por Tipo de Propiedad</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={[...propiedadesData].sort((a, b) => b.honorarios - a.honorarios)} layout="vertical">
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(val) => `$${val}`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                      <Tooltip formatter={(val) => `US$ ${val.toLocaleString()}`} />
                      <Bar dataKey="honorarios" fill="#10b981" radius={[0, 4, 4, 0]} name="Honorarios" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* AGENTES */}
          <TabsContent value="agentes" className="space-y-6">
            {agentesData.length === 0 ? (
              <p className="text-center text-slate-500 py-12">No hay datos de agentes para este período</p>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-2 font-semibold text-slate-700">Agente</th>
                          <th className="text-right py-3 px-2 font-semibold text-slate-700">Operaciones</th>
                          <th className="text-right py-3 px-2 font-semibold text-slate-700">Honorarios Totales</th>
                          <th className="text-right py-3 px-2 font-semibold text-slate-700">Precio Prom. Operación</th>
                        </tr>
                      </thead>
                      <tbody>
                        {agentesData.map((agente, idx) => (
                          <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="py-3 px-2 font-medium text-slate-900">{agente.name}</td>
                            <td className="text-right py-3 px-2 text-slate-600">{agente.operaciones}</td>
                            <td className="text-right py-3 px-2 font-semibold text-emerald-600">US$ {agente.honorarios.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                            <td className="text-right py-3 px-2 text-slate-600">US$ {agente.precioPromedio.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* PÉRDIDAS */}
          <TabsContent value="perdidas" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    Motivos de Pérdida (%)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {perdidasData.motivosArray.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={perdidasData.motivosArray}
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${percent}%`}
                          labelLine={false}
                        >
                          {perdidasData.motivosArray.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value, name, props) => [`${value} (${props.payload.percent}%)`, name]} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-slate-500 py-20">No hay datos de pérdidas en este período</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Análisis de Tiempo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center p-6 bg-slate-50 rounded-lg">
                    <p className="text-sm text-slate-500 mb-2">Tiempo Promedio hasta Pérdida</p>
                    <p className="text-4xl font-bold text-slate-900">{perdidasData.tiempoProm}</p>
                    <p className="text-sm text-slate-500 mt-1">días</p>
                  </div>
                  <div className="space-y-3">
                    {perdidasData.motivosArray.map((motivo, idx) => (
                      <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                        <span className="text-sm font-medium text-slate-700">{motivo.name}</span>
                        <div className="text-right">
                          <span className="text-lg font-bold text-slate-900">{motivo.value}</span>
                          <span className="text-xs text-slate-500 ml-2">({motivo.percent}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}