import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Copy, ExternalLink, Check, Sparkles } from "lucide-react";
import { api } from "@/api/client";
import { toast } from "sonner";
import { useWorkspace } from "@/components/context/WorkspaceContext";

function addBusinessDays(date, days) {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const d = result.getDay();
    if (d !== 0 && d !== 6) added++;
  }
  return result.toISOString().split('T')[0];
}

export default function PostventaWhatsAppSender({ open, onOpenChange, venta, contactoWhatsapp, onMessageSent }) {
  const { workspace } = useWorkspace();
  const [plantillas, setPlantillas] = useState([]);
  const [variablesDB, setVariablesDB] = useState([]);
  const [selectedPlantilla, setSelectedPlantilla] = useState(null);
  const [mensaje, setMensaje] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) loadData();
  }, [open]);

  useEffect(() => {
    if (selectedPlantilla && venta) {
      setMensaje(reemplazarVariables(selectedPlantilla.contenido, venta));
    }
  }, [selectedPlantilla, venta, variablesDB]);

  const loadData = async () => {
    if (!workspace?.id) return;
    const [allPlantillas, vars] = await Promise.all([
      api.entities.PlantillaWhatsApp.filter({ workspace_id: workspace.id, activa: true }),
      api.entities.VariablePlantilla.list("-updated_date", 500, { workspace_id: workspace.id })
    ]);
    setVariablesDB(vars);
    const postventa = allPlantillas.filter(p => p.etapa === 'Postventa');
    const lista = postventa.length > 0 ? postventa : allPlantillas;
    setPlantillas(lista);
    if (lista.length > 0) setSelectedPlantilla(lista[0]);
  };

  const reemplazarVariables = (texto, data) => {
    if (!texto) return "";
    let result = texto;
    variablesDB.forEach(v => {
      result = result.replace(new RegExp(`\\{${v.clave}\\}`, 'g'), v.valor);
    });
    return result
      .replace(/{NOMBRE}/g, data.nombreSnapshot || "")
      .replace(/{PRODUCTO}/g, data.productoSnapshot || data.modelo || "")
      .replace(/{GARANTIA}/g, "6 meses")
      .replace(/{SOPORTE}/g, "WhatsApp o Instagram")
      .replace(/{MONEDA}/g, data.moneda === "USD" ? "US$" : "$");
  };

  const formatPhone = (phone) => {
    if (!phone) return "";
    let clean = phone.replace(/[^0-9]/g, "");
    if (!clean.startsWith("54")) clean = "54" + clean;
    return clean;
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(mensaje);
    setCopied(true);
    toast.success("Mensaje copiado");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenWhatsApp = () => {
    const phone = formatPhone(contactoWhatsapp);
    const msg = String(mensaje || "").normalize("NFC")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
    const url = new URL("https://api.whatsapp.com/send");
    url.searchParams.set("phone", phone);
    url.searchParams.set("text", msg);
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  };

  const handleMarkSent = async () => {
    setLoading(true);
    const paso = venta.postventaPaso || 0;

    let updates;
    if (paso === 0) {
      updates = {
        postventaUltimoContacto: new Date().toISOString(),
        postventaEstado: 'Enviado',
        postventaPaso: 1,
        proximoSeguimientoPostventa: addBusinessDays(new Date(), 7)
      };
    } else {
      updates = {
        postventaUltimoContacto: new Date().toISOString(),
        postventaEstado: 'Cerrado',
        postventaActiva: false
      };
    }

    await api.entities.Venta.update(venta.id, updates);
    toast.success(paso === 0 ? "Enviado. Próximo contacto en 7 días hábiles." : "Postventa cerrada.");
    setLoading(false);
    onMessageSent?.();
    onOpenChange(false);
  };

  if (!venta) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-[#25D366]" />
            WhatsApp Postventa
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="font-semibold text-slate-900">{venta.nombreSnapshot}</p>
            <p className="text-sm text-slate-500">{contactoWhatsapp || "Sin número registrado"}</p>
            <div className="flex gap-2 mt-2 flex-wrap">
              <Badge variant="secondary">{venta.productoSnapshot || venta.modelo}</Badge>
              <Badge variant="outline">Paso {(venta.postventaPaso || 0) + 1} de 2</Badge>
              {venta.ganancia != null && (
                <Badge className="bg-emerald-100 text-emerald-700">
                  {venta.moneda} {venta.ganancia?.toFixed(0)} ganancia
                </Badge>
              )}
            </div>
          </div>

          {plantillas.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Plantilla
              </Label>
              <Select
                value={selectedPlantilla?.id}
                onValueChange={(val) => setSelectedPlantilla(plantillas.find(p => p.id === val))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar plantilla" />
                </SelectTrigger>
                <SelectContent>
                  {plantillas.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.nombrePlantilla}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Mensaje</Label>
            <Textarea
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              rows={6}
              className="resize-none"
              placeholder="Escribe tu mensaje..."
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleCopy} className="gap-2">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copiado" : "Copiar"}
          </Button>
          <Button
            onClick={handleOpenWhatsApp}
            disabled={!contactoWhatsapp}
            className="bg-[#25D366] hover:bg-[#20bd5a] text-white gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            Abrir WhatsApp
          </Button>
          <Button onClick={handleMarkSent} disabled={loading} className="gap-2">
            <Check className="w-4 h-4" />
            {(venta.postventaPaso || 0) === 0 ? "Enviado (→ Paso 2)" : "Marcar y Cerrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}