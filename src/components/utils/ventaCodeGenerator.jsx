import { api } from "@/api/client";

// Obtiene todas las ventas existentes y devuelve un mapa de año -> max secuencia
export async function getMaxSecuenciasPorAnio(workspaceId) {
  if (!workspaceId) throw new Error("workspace_id requerido para generar códigos de venta");
  const todasLasVentas = await api.entities.Venta.list("-codigo", 10000, { workspace_id: workspaceId });
  
  const maxPorAnio = {};
  
  todasLasVentas.forEach(venta => {
    if (!venta.codigo) return;
    
    const match = venta.codigo.match(/^V-(\d{4})-(\d{6})$/);
    if (match) {
      const year = match[1];
      const secuencia = parseInt(match[2], 10);
      
      if (!maxPorAnio[year] || secuencia > maxPorAnio[year]) {
        maxPorAnio[year] = secuencia;
      }
    }
  });
  
  return maxPorAnio;
}

// Genera el siguiente código para un año dado, usando el mapa de secuencias
export function generateNextVentaCode(year, maxPorAnio) {
  const maxSecuencia = maxPorAnio[String(year)] || 0;
  const siguienteSecuencia = maxSecuencia + 1;
  
  // Actualizar el mapa para la próxima llamada
  maxPorAnio[String(year)] = siguienteSecuencia;
  
  return `V-${year}-${String(siguienteSecuencia).padStart(6, '0')}`;
}