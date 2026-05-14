import { getAccessTokenForCalendar, updateCalendarEvent } from '@/lib/googleCalendar';
import { normalizeSeguimientoCalendarDay } from '@/components/utils/dateUtils';

/** Campos alineados con createCalendarEvent en ConsultaForm */
export function buildConsultaCalendarPayload(consulta, contactName) {
  const title = consulta.propiedadConsultada || consulta.productoConsultado || '';
  const name = contactName ?? consulta.contactoNombre ?? '';
  const description = [
    consulta.tipoPropiedad && `Tipo: ${consulta.tipoPropiedad}`,
    consulta.operacionBuscada && `Operación: ${consulta.operacionBuscada}`,
    consulta.barrio && `Barrio: ${consulta.barrio}`,
    consulta.prioridad && `Prioridad: ${consulta.prioridad}`,
  ]
    .filter(Boolean)
    .join('\n');
  return { title, description, contactName: name };
}

/**
 * @returns {Promise<{ ok: boolean, skipped?: boolean, notFound?: boolean, error?: Error }>}
 */
export async function syncConsultaProximoSeguimientoToGoogle(consulta, proximoSeguimiento) {
  const eventId = consulta.googleCalendarEventId;
  const day = normalizeSeguimientoCalendarDay(proximoSeguimiento);
  const token = await getAccessTokenForCalendar();
  if (!eventId || !token || !day) {
    return { ok: true, skipped: true };
  }
  const { title, description, contactName } = buildConsultaCalendarPayload(consulta);
  try {
    await updateCalendarEvent(eventId, {
      title,
      description,
      date: day,
      contactName,
    });
    return { ok: true };
  } catch (e) {
    const msg = e?.message || '';
    const notFound = /404|not found|deleted|was not found/i.test(msg);
    return { ok: false, error: e, notFound };
  }
}
