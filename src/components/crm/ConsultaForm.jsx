import { useState, useEffect } from "react";
import { useWorkspace } from "@/components/context/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/api/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { User, Search, Calendar, Plus, CalendarSync } from "lucide-react";
import moment from "moment";
import { getNextBusinessDay } from "@/components/utils/dateUtils";
import { Checkbox } from "@/components/ui/checkbox";
import { isGoogleCalendarConnected as isGCalConnected, createCalendarEvent } from "@/lib/googleCalendar";

const CANALES_DEFAULT = [
  "Zona Prop", "Argenprop", "MercadoLibre", "La Voz del Interior",
  "Facebook", "Instagram", "Estado WhatsApp", "Referido",
  "Cartel en propiedad", "Vitrina", "Base de datos propia", "Otro"
];
const TIPOS_PROPIEDAD = ["Departamento", "Casa", "Duplex", "PH", "Lote", "Local Comercial", "Oficina", "Campo", "Cochera"];
const OPERACIONES_BUSCADAS = ["Compra", "Alquiler", "Alquiler Temporal"];
const PRIORIDADES = ["Alta", "Media", "Baja"];
const CARACTERISTICAS_OPCIONES = [
  "Pileta", "Quincho", "SUM", "Gimnasio", "Seguridad 24h", "Laundry",
  "Balcón", "Terraza", "Patio", "Jardín", "Ascensor", "Baulera",
  "Parrilla", "Calefacción central", "Aire acondicionado", "Gas natural", "Agua corriente"
];
const MOTIVOS_PERDIDA = [
  "Fuera de presupuesto", "Se fue con otra inmobiliaria", "No encontró lo que buscaba",
  "Postergó decisión", "NoResponde", "Financiacion", "Otro"
];

export default function ConsultaForm({ open, onOpenChange, consulta, onSave }) {
  const [contactos, setContactos] = useState([]);
  const [showNewContact, setShowNewContact] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [syncGCal, setSyncGCal] = useState(false);
  const { workspace } = useWorkspace();

  const { data: etapas = [] } = useQuery({
    queryKey: ['pipeline-stages', workspace?.id],
    queryFn: async () => {
      if (!workspace) return [];
      const stages = await api.entities.PipelineStage.filter({ workspace_id: workspace.id }, "orden", 100);
      return stages.filter(s => s.activa !== false);
    },
    enabled: open && !!workspace
  });

  const { data: tags = [] } = useQuery({
    queryKey: ['tags', workspace?.id],
    queryFn: () => workspace ? api.entities.Tag.filter({ workspace_id: workspace.id }) : [],
    enabled: open && !!workspace
  });

  const canales = tags.filter(t => t.type === 'source').map(t => t.name);
  const canalesList = canales.length > 0 ? canales : CANALES_DEFAULT;

  const [formData, setFormData] = useState({
    contactoId: "",
    propiedadConsultada: "",
    tipoPropiedad: "",
    caracteristicas: [],
    barrio: "",
    operacionBuscada: "Compra",
    presupuestoMax: "",
    moneda: "USD",
    precioCotizado: "",
    etapa: "Nuevo lead",
    prioridad: "Media",
    canalOrigen: "",
    proximoSeguimiento: getNextBusinessDay(new Date(), 3),
    motivoPerdida: "",
    concretado: false,
  });

  const [newContact, setNewContact] = useState({
    nombre: "", apellido: "", whatsapp: "", ciudad: "", canalOrigen: ""
  });

  useEffect(() => {
    if (workspace) loadContactos();
  }, [workspace]);

  useEffect(() => {
    if (consulta) {
      setFormData({
        ...consulta,
        propiedadConsultada: consulta.propiedadConsultada || consulta.productoConsultado || "",
        tipoPropiedad: consulta.tipoPropiedad || consulta.categoriaProducto || "",
        caracteristicas: Array.isArray(consulta.caracteristicas)
          ? consulta.caracteristicas
          : (consulta.caracteristicas ? consulta.caracteristicas.split(',').map(s => s.trim()).filter(Boolean) : []),
        presupuestoMax: consulta.presupuestoMax || "",
        precioCotizado: consulta.precioCotizado || "",
        proximoSeguimiento: consulta.proximoSeguimiento || "",
        concretado: !!consulta.concretado,
      });
    } else {
      setFormData({
        contactoId: "",
        propiedadConsultada: "",
        tipoPropiedad: "",
        caracteristicas: [],
        barrio: "",
        operacionBuscada: "Compra",
        presupuestoMax: "",
        moneda: "USD",
        precioCotizado: "",
        etapa: etapas[0]?.nombre || "Nuevo lead",
        prioridad: "Media",
        canalOrigen: "",
        proximoSeguimiento: getNextBusinessDay(new Date(), 3),
        motivoPerdida: "",
        concretado: false,
      });
    }
  }, [consulta, open]);

  const loadContactos = async () => {
    if (!workspace) return;
    const data = await api.entities.Contacto.filter({ workspace_id: workspace.id }, "-created_date", 100);
    setContactos(data);
  };

  const handleCreateContact = async () => {
    if (!newContact.nombre || !newContact.whatsapp) {
      toast.error("Nombre y WhatsApp son requeridos");
      return;
    }
    setLoading(true);
    const created = await api.entities.Contacto.create({
      ...newContact,
      numeroTelefono: newContact.whatsapp,
      workspace_id: workspace?.id
    });
    setContactos([created, ...contactos]);
    setFormData({ ...formData, contactoId: created.id });
    setShowNewContact(false);
    setNewContact({ nombre: "", apellido: "", whatsapp: "", ciudad: "", canalOrigen: "" });
    toast.success("Contacto creado");
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (!formData.contactoId || !formData.propiedadConsultada) {
      toast.error("Contacto y búsqueda son requeridos");
      return;
    }
    setSubmitting(true);
    try {
      const contacto = contactos.find(c => c.id === formData.contactoId);
      const dataToSave = {
        ...formData,
        contactoNombre: contacto?.nombre,
        contactoWhatsapp: contacto?.whatsapp,
        presupuestoMax: formData.presupuestoMax ? Number(formData.presupuestoMax) : null,
        precioCotizado: formData.precioCotizado ? Number(formData.precioCotizado) : null,
        fechaConsulta: consulta?.fechaConsulta || moment().format("YYYY-MM-DD"),
        workspace_id: workspace?.id
      };
      if (formData.concretado && formData.etapa !== "Operación cerrada") {
        dataToSave.etapa = "Operación cerrada";
      }
      if (consulta) {
        await api.entities.Consulta.update(consulta.id, dataToSave);
        toast.success("Consulta actualizada");
      } else {
        await api.entities.Consulta.create(dataToSave);
        toast.success("Consulta / lead creada");

        if (syncGCal && isGCalConnected() && formData.proximoSeguimiento) {
          try {
            await createCalendarEvent({
              title: formData.propiedadConsultada,
              description: [
                formData.tipoPropiedad && `Tipo: ${formData.tipoPropiedad}`,
                formData.operacionBuscada && `Operación: ${formData.operacionBuscada}`,
                formData.barrio && `Barrio: ${formData.barrio}`,
                formData.prioridad && `Prioridad: ${formData.prioridad}`,
              ].filter(Boolean).join("\n"),
              date: formData.proximoSeguimiento,
              contactName: contacto?.nombre,
            });
            toast.success("Evento creado en Google Calendar");
          } catch (err) {
            console.error("Google Calendar sync failed:", err);
            toast.error("No se pudo crear el evento en Google Calendar");
          }
        }
      }
      onSave?.();
      onOpenChange(false);
    } catch {
      toast.error("Error al guardar la consulta");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedContact = contactos.find(c => c.id === formData.contactoId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {consulta ? "Editar Consulta / Lead" : "Nueva Consulta / Lead"}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="contacto" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="contacto" className="gap-2">
              <User className="w-4 h-4" /> Contacto
            </TabsTrigger>
            <TabsTrigger value="busqueda" className="gap-2">
              <Search className="w-4 h-4" /> Búsqueda
            </TabsTrigger>
            <TabsTrigger value="seguimiento" className="gap-2">
              <Calendar className="w-4 h-4" /> Seguimiento
            </TabsTrigger>
          </TabsList>

          <TabsContent value="contacto" className="space-y-4 mt-4">
            {!showNewContact ? (
              <>
                <div className="space-y-2">
                  <Label>Contacto existente</Label>
                  <Select value={formData.contactoId} onValueChange={(val) => setFormData({ ...formData, contactoId: val })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar contacto" />
                    </SelectTrigger>
                    <SelectContent>
                      {contactos.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.nombre} {c.apellido} - {c.whatsapp}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedContact && (
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="font-semibold">{selectedContact.nombre} {selectedContact.apellido}</p>
                    <p className="text-sm text-slate-500">{selectedContact.whatsapp}</p>
                    {selectedContact.ciudad && <p className="text-sm text-slate-500">{selectedContact.ciudad}</p>}
                  </div>
                )}
                <Button type="button" variant="outline" onClick={() => setShowNewContact(true)} className="w-full gap-2">
                  <Plus className="w-4 h-4" />Crear nuevo contacto
                </Button>
              </>
            ) : (
              <div className="space-y-4 border rounded-xl p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nombre *</Label>
                    <Input value={newContact.nombre} onChange={(e) => setNewContact({ ...newContact, nombre: e.target.value })} placeholder="Juan" />
                  </div>
                  <div className="space-y-2">
                    <Label>Apellido</Label>
                    <Input value={newContact.apellido} onChange={(e) => setNewContact({ ...newContact, apellido: e.target.value })} placeholder="Pérez" />
                  </div>
                  <div className="space-y-2">
                    <Label>WhatsApp *</Label>
                    <Input value={newContact.whatsapp} onChange={(e) => setNewContact({ ...newContact, whatsapp: e.target.value })} placeholder="+54 9 351 123-4567" />
                  </div>
                  <div className="space-y-2">
                    <Label>Ciudad</Label>
                    <Input value={newContact.ciudad} onChange={(e) => setNewContact({ ...newContact, ciudad: e.target.value })} placeholder="Córdoba" />
                  </div>
                  <div className="space-y-2">
                    <Label>Canal de origen</Label>
                    <Select value={newContact.canalOrigen} onValueChange={(val) => setNewContact({ ...newContact, canalOrigen: val })}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                      <SelectContent>
                        {canalesList.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowNewContact(false)}>Cancelar</Button>
                  <Button type="button" onClick={handleCreateContact} disabled={loading}>Crear contacto</Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="busqueda" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label>¿Qué propiedad busca? *</Label>
                <Input
                  value={formData.propiedadConsultada}
                  onChange={(e) => setFormData({ ...formData, propiedadConsultada: e.target.value })}
                  placeholder="Dpto 2 amb. en Nueva Córdoba, con cochera"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de propiedad</Label>
                <Select value={formData.tipoPropiedad} onValueChange={(val) => setFormData({ ...formData, tipoPropiedad: val })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_PROPIEDAD.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Operación buscada</Label>
                <Select value={formData.operacionBuscada} onValueChange={(val) => setFormData({ ...formData, operacionBuscada: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OPERACIONES_BUSCADAS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Barrio/Zona preferida</Label>
                <Input
                  value={formData.barrio}
                  onChange={(e) => setFormData({ ...formData, barrio: e.target.value })}
                  placeholder="Nueva Córdoba, General Paz..."
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Características buscadas</Label>
                <div className="flex flex-wrap gap-2 p-3 border rounded-md bg-white min-h-[44px]">
                  {CARACTERISTICAS_OPCIONES.map(c => {
                    const selected = (formData.caracteristicas || []).includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          const current = formData.caracteristicas || [];
                          setFormData({
                            ...formData,
                            caracteristicas: selected
                              ? current.filter(x => x !== c)
                              : [...current, c]
                          });
                        }}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                          selected
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-600 border-slate-300 hover:border-slate-500'
                        }`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Precio de propiedad mostrada</Label>
                <div className="flex gap-2">
                  <Select value={formData.moneda} onValueChange={(val) => setFormData({ ...formData, moneda: val })}>
                    <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="ARS">ARS</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="number" value={formData.precioCotizado} onChange={(e) => setFormData({ ...formData, precioCotizado: e.target.value })} placeholder="120000" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Presupuesto máximo</Label>
                <Input type="number" value={formData.presupuestoMax} onChange={(e) => setFormData({ ...formData, presupuestoMax: e.target.value })} placeholder="150000" />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="seguimiento" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Etapa</Label>
                <Select value={formData.etapa} onValueChange={(val) => setFormData({ ...formData, etapa: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {etapas.map(e => <SelectItem key={e.nombre} value={e.nombre}>{e.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridad</Label>
                <Select value={formData.prioridad} onValueChange={(val) => setFormData({ ...formData, prioridad: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORIDADES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Canal de origen</Label>
                <Select value={formData.canalOrigen} onValueChange={(val) => setFormData({ ...formData, canalOrigen: val })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {canalesList.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Próximo seguimiento</Label>
                <Input type="date" value={formData.proximoSeguimiento} onChange={(e) => setFormData({ ...formData, proximoSeguimiento: e.target.value })} />
              </div>
              {formData.etapa === "No concretado" && (
                <div className="space-y-2 col-span-2">
                  <Label>Motivo de pérdida</Label>
                  <Select value={formData.motivoPerdida} onValueChange={(val) => setFormData({ ...formData, motivoPerdida: val })}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar motivo" /></SelectTrigger>
                    <SelectContent>
                      {MOTIVOS_PERDIDA.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {!consulta && isGCalConnected() && (
                <div className="col-span-2 flex items-center gap-3 p-3 bg-slate-50 rounded-xl border">
                  <Checkbox
                    id="syncGCal"
                    checked={syncGCal}
                    onCheckedChange={(checked) => setSyncGCal(!!checked)}
                  />
                  <div className="flex items-center gap-2">
                    <CalendarSync className="w-4 h-4 text-slate-500" />
                    <Label htmlFor="syncGCal" className="cursor-pointer text-sm font-normal">
                      Sincronizar con Google Calendar
                    </Label>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Guardando..." : consulta ? "Guardar cambios" : "Crear consulta / lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}