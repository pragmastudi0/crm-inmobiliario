// Utilidades para manejo de fechas

/**
 * Convierte proximoSeguimiento (YYYY-MM-DD, ISO con hora, etc.) a YYYY-MM-DD
 * para comparar y enviar a Google Calendar sin depender del huso horario del string.
 */
export function normalizeSeguimientoCalendarDay(value) {
  if (value == null || value === '') return '';
  const s = String(value).trim();
  const head = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (head) return head[1];
  const t = Date.parse(s);
  if (Number.isNaN(t)) return '';
  const d = new Date(t);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getNextBusinessDay(startDate, businessDaysToAdd) {
  let currentDate = new Date(startDate);
  let daysCount = 0;

  while (daysCount < businessDaysToAdd) {
    currentDate.setDate(currentDate.getDate() + 1); // Avanza un día
    const dayOfWeek = currentDate.getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado

    // Si no es sábado (6) ni domingo (0), es un día hábil
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      daysCount++;
    }
  }

  // Formatear la fecha a YYYY-MM-DD
  const year = currentDate.getFullYear();
  const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
  const day = currentDate.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}