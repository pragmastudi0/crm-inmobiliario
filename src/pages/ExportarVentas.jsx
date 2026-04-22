import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Download, FileSpreadsheet } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { api } from "@/api/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { useQuery } from "@tanstack/react-query";
import { useWorkspace } from "@/components/context/WorkspaceContext";

export default function ExportarVentas() {
  const { workspace } = useWorkspace();
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [marketplace, setMarketplace] = useState("all");
  const [proveedor, setProveedor] = useState("all");
  const [estado, setEstado] = useState("all");
  const [vendedor, setVendedor] = useState("all");
  const [loading, setLoading] = useState(false);

  const { data: proveedores = [] } = useQuery({
    queryKey: ['proveedores', workspace?.id],
    queryFn: () => (workspace ? api.entities.Proveedor.filter({ workspace_id: workspace.id, activo: true }) : []),
    enabled: !!workspace,
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios', workspace?.id],
    queryFn: () => (workspace ? api.entities.User.list({ workspace_id: workspace.id }) : []),
    enabled: !!workspace,
  });

  const buildQuery = () => {
    const query = { workspace_id: workspace?.id };

    if (fechaDesde) {
      query.fecha = { $gte: fechaDesde };
    }
    if (fechaHasta) {
      if (query.fecha) {
        query.fecha.$lte = fechaHasta;
      } else {
        query.fecha = { $lte: fechaHasta };
      }
    }
    if (marketplace !== "all") {
      query.marketplace = marketplace;
    }
    if (estado !== "all") {
      query.estado = estado;
    }
    if (vendedor !== "all") {
      query.porUsuarioId = vendedor;
    }
    if (proveedor !== "all") {
      query.proveedorTexto = proveedor;
    }

    return query;
  };

  const formatDataForExport = (ventas) => {
    return ventas.map(venta => ({
      'CÓDIGO': venta.codigo || '',
      'FECHA': venta.fecha || '',
      'NOMBRE': venta.nombreSnapshot || '',
      'MODELO': venta.modelo || '',
      'CAPACIDAD': venta.capacidad || '',
      'COLOR': venta.color || '',
      'PROVEEDOR': venta.proveedorTexto || venta.proveedorNombreSnapshot || '',
      'MARKETPLACE': venta.marketplace || '',
      'COSTO': venta.costo || 0,
      'COMISION': venta.comision || 0,
      'VENTA': venta.venta || 0,
      'GANANCIA': venta.ganancia || 0
    }));
  };

  const handleExportCSV = async () => {
    setLoading(true);
    try {
      const query = buildQuery();
      const ventas = await api.entities.Venta.filter(query);

      if (ventas.length === 0) {
        toast.error("No hay ventas para exportar con los filtros seleccionados");
        setLoading(false);
        return;
      }

      const data = formatDataForExport(ventas);

      // Crear CSV
      const headers = Object.keys(data[0]);
      const csvContent = [
        headers.join(','),
        ...data.map(row => 
          headers.map(header => {
            const value = row[header];
            // Escapar comas y comillas
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(',')
        )
      ].join('\n');

      // Descargar
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ventas_export_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success(`${ventas.length} ventas exportadas a CSV`);
    } catch (error) {
      toast.error(`Error al exportar: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    setLoading(true);
    try {
      const query = buildQuery();
      const ventas = await api.entities.Venta.filter(query);

      if (ventas.length === 0) {
        toast.error("No hay ventas para exportar con los filtros seleccionados");
        setLoading(false);
        return;
      }

      const data = formatDataForExport(ventas);

      // Crear workbook
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Ventas");

      // Descargar
      XLSX.writeFile(wb, `ventas_export_${new Date().toISOString().split('T')[0]}.xlsx`);

      toast.success(`${ventas.length} ventas exportadas a Excel`);
    } catch (error) {
      toast.error(`Error al exportar: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link to={createPageUrl("Ventas")}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Exportar Ventas</h1>
            <p className="text-sm text-slate-500">Descarga tus ventas a CSV o Excel</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Configurar exportación
            </CardTitle>
            <CardDescription>
              Aplica filtros y selecciona el formato de descarga
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Filtros de fecha */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha Desde</Label>
                <Input 
                  type="date" 
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha Hasta</Label>
                <Input 
                  type="date" 
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                />
              </div>
            </div>

            {/* Filtros de categorías */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Marketplace</Label>
                <Select value={marketplace} onValueChange={setMarketplace}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                    <SelectItem value="Instagram">Instagram</SelectItem>
                    <SelectItem value="MercadoLibre">MercadoLibre</SelectItem>
                    <SelectItem value="Local">Local</SelectItem>
                    <SelectItem value="Otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Estado</Label>
                <Select value={estado} onValueChange={setEstado}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="Borrador">Borrador</SelectItem>
                    <SelectItem value="Finalizada">Finalizada</SelectItem>
                    <SelectItem value="Anulada">Anulada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Proveedor</Label>
                <Select value={proveedor} onValueChange={setProveedor}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {proveedores.map(p => (
                      <SelectItem key={p.id} value={p.nombre}>
                        {p.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Vendedor</Label>
                <Select value={vendedor} onValueChange={setVendedor}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {usuarios.map(u => (
                      <SelectItem key={u.id} value={u.email}>
                        {u.full_name || u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Botones de exportación */}
            <div className="flex gap-3 pt-4 border-t">
              <Button 
                onClick={handleExportCSV} 
                disabled={loading}
                className="flex-1"
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar CSV (UTF-8)
              </Button>
              <Button 
                onClick={handleExportExcel} 
                disabled={loading}
                className="flex-1"
                variant="outline"
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Exportar Excel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}