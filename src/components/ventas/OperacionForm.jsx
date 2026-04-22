import { useState, useEffect } from "react";
import { api } from "@/api/client";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/components/context/WorkspaceContext";

const TIPOS_OPERACION = ["Venta", "Alquiler", "Alquiler Temporal", "Tasación"];
const ESTADOS = ["En gestión", "Boleto firmado", "Escriturada", "Entregada", "Caída"];
const TIPOS_PROPIEDAD = ["Departamento", "Casa", "Duplex", "PH", "Lote", "Local Comercial", "Oficina", "Campo", "Cochera"];

export default function OperacionForm({ open, onOpenChange, consulta, onOperacionCreada, operacionExistente = null }) {
  const { workspace } = useWorkspace();

  const { data: miembros = [] } = useQuery({
    queryKey: ['workspace-members-op', workspace?.id],
    queryFn: () => workspace ? api.entities.WorkspaceMember.filter({ workspace_id: workspace.id }) : [],
    enabled: open && !!workspace
  });

  const defaultForm = {
    estado: "En gestión",
    tipoOperacion: "Venta",
    fecha: new Date().toISOString().split('T')[0],
    contactoId: "",
    consultaId: "",
    propiedadDescripcion: "",
    tipoPropiedad: "",
    direccion: "",
    barrio: "",
    superficie: "",
    ambientes: "",
    propietarioNombre: "",
    propietarioWhatsapp: "",
    nombreSnapshot: "",
    apellidoSnapshot: "",
    compradorWhatsapp: "",
    precioOperacion: "",
    moneda: "USD",
    honorariosPct: 3,
    agenteCaptor: "",
    agenteVendedor: "",
    repartoCaptor: 50,
    repartoVendedor: 50,
    fechaReserva: "",
    fechaBoleto: "",
    fechaEscritura: "",
    fechaEntrega: "",
    escribano: "",
    notas: ""
  };

  const [formData, setFormData] = useState(defaultForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Calculated values
  const honorariosTotal = formData.precioOperacion && formData.honorariosPct
    ? (parseFloat(formData.precioOperacion) * parseFloat(formData.honorariosPct) / 100)
    : null;
  const comisionCaptor = honorariosTotal && formData.repartoCaptor
    ? (honorariosTotal * parseFloat(formData.repartoCaptor) / 100)
    : null;
  const comisionVendedor = honorariosTotal && formData.repartoVendedor
    ? (honorariosTotal * parseFloat(formData.repartoVendedor) / 100)
    : null;
  const repartoTotal = parseFloat(formData.repartoCaptor || 0) + parseFloat(formData.repartoVendedor || 0);

  useEffect(() => {
    if (operacionExistente && open) {
      setFormData({ ...defaultForm, ...operacionExistente });
    } else if (consulta && open) {
      setFormData({
        ...defaultForm,
        contactoId: consulta.contactoId || "",
        consultaId: consulta.id || "",
        nombreSnapshot: (consulta.contactoNombre || "").split(" ")[0],
        apellidoSnapshot: (consulta.contactoNombre || "").split(" ").slice(1).join(" "),
        propiedadDescripcion: consulta.propiedadConsultada || "",
        tipoPropiedad: consulta.tipoPropiedad || "",
        barrio: consulta.barrio || "",
        precioOperacion: consulta.precioCotizado || "",
        moneda: consulta.moneda || "USD",
        compradorWhatsapp: consulta.contactoWhatsapp || ""
      });
    } else if (open && !operacionExistente && !consulta) {
      setFormData(defaultForm);
    }
    setErrors({});
  }, [consulta, operacionExistente, open]);

  const validate = () => {
    const errs = {};
    if (!formData.nombreSnapshot) errs.nombreSnapshot = "El nombre del cliente es obligatorio";
    if (formData.honorariosPct && (parseFloat(formData.honorariosPct) < 1 || parseFloat(formData.honorariosPct) > 10)) {
      errs.honorariosPct = "Los honorarios deben estar entre 1% y 10%";
    }
    if (Math.round(repartoTotal) !== 100) {
      errs.reparto = `El reparto debe sumar 100% (actualmente ${repartoTotal}%)`;
    }
    if (formData.fechaEscritura && formData.fechaBoleto && formData.fechaEscritura < formData.fechaBoleto) {
      errs.fechaEscritura = "La fecha de escritura no puede ser anterior al boleto";
    }
    return errs;
  };

  const handleSubmit = async (estadoFinal) => {
    if (submitting) return;
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      toast.error("Hay errores en el formulario");
      return;
    }

    setSubmitting(true);
    try {
      const dataToSave = {
        ...formData,
        estado: estadoFinal || formData.estado,
        precioOperacion: formData.precioOperacion ? parseFloat(formData.precioOperacion) : null,
        honorariosPct: parseFloat(formData.honorariosPct) || 3,
        honorariosTotal,
        comisionCaptor,
        comisionVendedor,
        repartoCaptor: parseFloat(formData.repartoCaptor) || 50,
        repartoVendedor: parseFloat(formData.repartoVendedor) || 50,
        superficie: formData.superficie ? parseFloat(formData.superficie) : null,
        ambientes: formData.ambientes ? parseInt(formData.ambientes) : null,
        workspace_id: workspace?.id
      };

      if (operacionExistente) {
        await api.entities.Venta.update(operacionExistente.id, dataToSave);
        toast.success("Operación actualizada");
      } else {
        const ops = await api.entities.Venta.list("-created_date", 1, { workspace_id: workspace?.id });
        let nuevoCodigo = `OP-${new Date().getFullYear()}-000001`;
        if (ops.length > 0 && ops[0].codigo) {
          const partes = ops[0].codigo.split('-');
          if (partes.length === 3) {
            const num = parseInt(partes[2]) + 1;
            nuevoCodigo = `OP-${new Date().getFullYear()}-${num.toString().padStart(6, '0')}`;
          }
        }
        dataToSave.codigo = nuevoCodigo;
        await api.entities.Venta.create(dataToSave);
        toast.success("Operación registrada");
      }

      onOperacionCreada?.();
      onOpenChange(false);
    } catch {
      toast.error("Error al guardar la operación");
    } finally {
      setSubmitting(false);
    }
  };

  const isTasacion = formData.tipoOperacion === "Tasación";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            {operacionExistente ? "Editar Operación" : "Registrar Operación"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Tipo y estado */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de operación *</Label>
              <Select value={formData.tipoOperacion} onValueChange={(v) => setFormData({ ...formData, tipoOperacion: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_OPERACION.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={formData.estado} onValueChange={(v) => setFormData({ ...formData, estado: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ESTADOS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fecha</Label>
              <Input type="date" value={formData.fecha} onChange={(e) => setFormData({ ...formData, fecha: e.target.value })} />
            </div>
          </div>

          {/* Propiedad */}
          <div className="space-y-3 p-4 bg-slate-50 rounded-xl">
            <p className="font-semibold text-slate-700 text-sm">Propiedad</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label>Descripción de la propiedad</Label>
                <Input value={formData.propiedadDescripcion} onChange={(e) => setFormData({ ...formData, propiedadDescripcion: e.target.value })} placeholder="Dpto 2 amb. en Nueva Córdoba, piso 4, con balcón" />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={formData.tipoPropiedad} onValueChange={(v) => setFormData({ ...formData, tipoPropiedad: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_PROPIEDAD.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Barrio/Zona</Label>
                <Input value={formData.barrio} onChange={(e) => setFormData({ ...formData, barrio: e.target.value })} placeholder="Nueva Córdoba" />
              </div>
              <div className="space-y-2">
                <Label>Dirección</Label>
                <Input value={formData.direccion} onChange={(e) => setFormData({ ...formData, direccion: e.target.value })} placeholder="Av. Colón 1234" />
              </div>
              <div className="space-y-2">
                <Label>Superficie (m²)</Label>
                <Input type="number" value={formData.superficie} onChange={(e) => setFormData({ ...formData, superficie: e.target.value })} placeholder="65" />
              </div>
              <div className="space-y-2">
                <Label>Ambientes</Label>
                <Input type="number" value={formData.ambientes} onChange={(e) => setFormData({ ...formData, ambientes: e.target.value })} placeholder="2" />
              </div>
            </div>
          </div>

          {/* Propietario */}
          <div className="space-y-3 p-4 bg-slate-50 rounded-xl">
            <p className="font-semibold text-slate-700 text-sm">Propietario</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre del propietario</Label>
                <Input value={formData.propietarioNombre} onChange={(e) => setFormData({ ...formData, propietarioNombre: e.target.value })} placeholder="María González" />
              </div>
              <div className="space-y-2">
                <Label>WhatsApp del propietario</Label>
                <Input value={formData.propietarioWhatsapp} onChange={(e) => setFormData({ ...formData, propietarioWhatsapp: e.target.value })} placeholder="+54 9 351 123-4567" />
              </div>
            </div>
          </div>

          {/* Comprador/Inquilino — oculto en Tasación */}
          {!isTasacion && (
            <div className="space-y-3 p-4 bg-blue-50 rounded-xl">
              <p className="font-semibold text-slate-700 text-sm">
                {formData.tipoOperacion === "Venta" ? "Comprador" : "Inquilino"}
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre *</Label>
                  <Input value={formData.nombreSnapshot} onChange={(e) => setFormData({ ...formData, nombreSnapshot: e.target.value })} placeholder="Juan" />
                  {errors.nombreSnapshot && <p className="text-xs text-red-600">{errors.nombreSnapshot}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Apellido</Label>
                  <Input value={formData.apellidoSnapshot} onChange={(e) => setFormData({ ...formData, apellidoSnapshot: e.target.value })} placeholder="Pérez" />
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp</Label>
                  <Input value={formData.compradorWhatsapp} onChange={(e) => setFormData({ ...formData, compradorWhatsapp: e.target.value })} placeholder="+54 9 351 123-4567" />
                </div>
              </div>
            </div>
          )}
          {isTasacion && (
            <div className="space-y-2">
              <Label>Nombre del solicitante *</Label>
              <Input value={formData.nombreSnapshot} onChange={(e) => setFormData({ ...formData, nombreSnapshot: e.target.value })} placeholder="Nombre del solicitante de la tasación" />
              {errors.nombreSnapshot && <p className="text-xs text-red-600">{errors.nombreSnapshot}</p>}
            </div>
          )}

          {/* Financiero */}
          <div className="space-y-3 p-4 bg-emerald-50 rounded-xl">
            <p className="font-semibold text-slate-700 text-sm">Financiero / Honorarios</p>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Precio de operación</Label>
                <Input type="number" value={formData.precioOperacion} onChange={(e) => setFormData({ ...formData, precioOperacion: e.target.value })} placeholder="120000" />
              </div>
              <div className="space-y-2">
                <Label>Moneda</Label>
                <Select value={formData.moneda} onValueChange={(v) => setFormData({ ...formData, moneda: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="ARS">ARS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Honorarios %</Label>
                <Input type="number" step="0.1" value={formData.honorariosPct} onChange={(e) => setFormData({ ...formData, honorariosPct: e.target.value })} placeholder="3" />
                {errors.honorariosPct && <p className="text-xs text-red-600">{errors.honorariosPct}</p>}
              </div>
            </div>

            {honorariosTotal !== null && (
              <div className="flex items-center justify-between bg-white rounded-lg p-3 border border-emerald-200">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                  <span className="font-semibold text-slate-700">Honorarios totales:</span>
                </div>
                <span className="text-2xl font-bold text-emerald-600">
                  {formData.moneda} {honorariosTotal.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                </span>
              </div>
            )}

            {/* Reparto */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-600">Reparto entre agentes</p>
              {errors.reparto && (
                <div className="flex items-center gap-1 text-xs text-red-600">
                  <AlertCircle className="w-3.5 h-3.5" />{errors.reparto}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Agente Captor</Label>
                  <Select value={formData.agenteCaptor} onValueChange={(v) => setFormData({ ...formData, agenteCaptor: v })}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {miembros.map(m => (
                        <SelectItem key={m.user_id} value={m.user_id}>
                          {m.full_name || m.email || m.user_id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2">
                    <Input type="number" value={formData.repartoCaptor} onChange={(e) => setFormData({ ...formData, repartoCaptor: e.target.value })} className="w-20" placeholder="50" />
                    <span className="text-sm text-slate-500">%</span>
                    {comisionCaptor !== null && <Badge variant="outline" className="text-emerald-700 border-emerald-200">{formData.moneda} {comisionCaptor.toLocaleString('es-AR', { minimumFractionDigits: 0 })}</Badge>}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Agente Vendedor</Label>
                  <Select value={formData.agenteVendedor} onValueChange={(v) => setFormData({ ...formData, agenteVendedor: v })}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {miembros.map(m => (
                        <SelectItem key={m.user_id} value={m.user_id}>
                          {m.full_name || m.email || m.user_id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2">
                    <Input type="number" value={formData.repartoVendedor} onChange={(e) => setFormData({ ...formData, repartoVendedor: e.target.value })} className="w-20" placeholder="50" />
                    <span className="text-sm text-slate-500">%</span>
                    {comisionVendedor !== null && <Badge variant="outline" className="text-emerald-700 border-emerald-200">{formData.moneda} {comisionVendedor.toLocaleString('es-AR', { minimumFractionDigits: 0 })}</Badge>}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Fechas hito */}
          <div className="space-y-3">
            <p className="font-semibold text-slate-700 text-sm">Fechas de la operación</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Reserva</Label>
                <Input type="date" value={formData.fechaReserva} onChange={(e) => setFormData({ ...formData, fechaReserva: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Boleto</Label>
                <Input type="date" value={formData.fechaBoleto} onChange={(e) => setFormData({ ...formData, fechaBoleto: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Escritura</Label>
                <Input type="date" value={formData.fechaEscritura} onChange={(e) => setFormData({ ...formData, fechaEscritura: e.target.value })} />
                {errors.fechaEscritura && <p className="text-xs text-red-600">{errors.fechaEscritura}</p>}
              </div>
              <div className="space-y-2">
                <Label>Entrega de llaves</Label>
                <Input type="date" value={formData.fechaEntrega} onChange={(e) => setFormData({ ...formData, fechaEntrega: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Escribano</Label>
              <Input value={formData.escribano} onChange={(e) => setFormData({ ...formData, escribano: e.target.value })} placeholder="Dr. Rodríguez - Av. Figueroa Alcorta 1234" />
            </div>
          </div>

          {/* Notas */}
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea value={formData.notas} onChange={(e) => setFormData({ ...formData, notas: e.target.value })} rows={3} placeholder="Condiciones especiales, observaciones..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => handleSubmit(null)} disabled={submitting}>
            {submitting ? "Guardando..." : operacionExistente ? "Actualizar" : "Guardar operación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}