import { GOOGLE_CALENDAR_OAUTH_CLIENT_ID } from '@/lib/googleCalendarClientId';
import { normalizeSeguimientoCalendarDay } from '@/components/utils/dateUtils';

/** calendar.events: crear/editar eventos. userinfo.email: leer email en oauth2/v2/userinfo (evita 401 con solo calendar). */
const SCOPES =
  'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email';

const TOKEN_KEY = 'gcal_token';
const TOKEN_EXPIRY_KEY = 'gcal_token_expiry';
const EMAIL_KEY = 'gcal_user_email';
/** Set after successful OAuth (consent or silent); enables silent token refresh. */
const LINKED_KEY = 'gcal_oauth_linked';

/** Fin exclusivo para eventos all-day (Calendar API v3). */
function exclusiveEndDateForAllDay(startYyyyMmDd) {
  const start = normalizeSeguimientoCalendarDay(startYyyyMmDd);
  if (!start) return start;
  const [y, m, d] = start.split('-').map(Number);
  const u = new Date(Date.UTC(y, m - 1, d));
  u.setUTCDate(u.getUTCDate() + 1);
  return u.toISOString().slice(0, 10);
}

export function getClientId() {
  return GOOGLE_CALENDAR_OAUTH_CLIENT_ID;
}

export function getConnectedEmail() {
  return localStorage.getItem(EMAIL_KEY) || '';
}

/** True if this browser previously completed Google OAuth for Calendar (consent or silent). */
export function isOAuthLinked() {
  return localStorage.getItem(LINKED_KEY) === '1';
}

export function setOAuthLinked(value) {
  if (value) localStorage.setItem(LINKED_KEY, '1');
  else localStorage.removeItem(LINKED_KEY);
}

/**
 * If the CRM profile indicates Calendar was linked before, mirror that to localStorage
 * so silent refresh can run even if only the token keys were cleared.
 */
export function syncOAuthLinkedFlagFromProfile(profile) {
  if (!profile) return;
  if (profile.google_calendar_linked_at || profile.google_calendar_email) {
    setOAuthLinked(true);
  }
}

async function fetchUserEmail(accessToken) {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.email || null;
}

let scriptLoaded = false;

function loadGISScript() {
  return new Promise((resolve, reject) => {
    if (scriptLoaded || window.google?.accounts) {
      scriptLoaded = true;
      return resolve();
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = () => {
      scriptLoaded = true;
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function persistTokenFromResponse(response) {
  const expiry = Date.now() + (response.expires_in - 60) * 1000;
  localStorage.setItem(TOKEN_KEY, response.access_token);
  localStorage.setItem(TOKEN_EXPIRY_KEY, expiry.toString());
}

/**
 * @param {string} clientId
 * @param {'' | 'consent' | 'select_account'} prompt
 * @returns {Promise<{ access_token: string, email: string | null }>}
 */
function requestAccessTokenWithPrompt(clientId, prompt) {
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: async (response) => {
        if (response.error) {
          const errCode = response.error;
          const errDesc = response.error_description || '';
          if (
            errCode === 'invalid_client' ||
            /invalid_client|OAuth client was not found/i.test(String(errDesc))
          ) {
            return reject(
              new Error(
                'Google no reconoce este Client ID (invalid_client). En Google Cloud Console verificá que exista un cliente OAuth tipo "Aplicación web" con exactamente este ID, que el proyecto esté activo y que en el deploy no haya un VITE_GOOGLE_OAUTH_CLIENT_ID incorrecto.'
              )
            );
          }
          return reject(
            new Error(
              typeof errDesc === 'string' && errDesc
                ? errDesc
                : errCode || 'Error de autorización con Google'
            )
          );
        }
        persistTokenFromResponse(response);
        setOAuthLinked(true);
        let email = null;
        try {
          email = await fetchUserEmail(response.access_token);
          if (email) localStorage.setItem(EMAIL_KEY, email);
        } catch {
          /* email opcional */
        }
        resolve({ access_token: response.access_token, email });
      },
    });
    client.requestAccessToken({ prompt });
  });
}

/**
 * @param {{ forceConsent?: boolean }} options
 * @returns {Promise<{ access_token: string, email: string | null }>}
 */
export async function connectGoogleCalendar(clientId, options = {}) {
  const { forceConsent = true } = options;
  await loadGISScript();
  const prompt = forceConsent ? 'consent' : '';
  return requestAccessTokenWithPrompt(clientId, prompt);
}

/**
 * @param {{ forceConsent?: boolean }} options - first connect / reconnect: forceConsent true (default)
 * @returns {Promise<{ access_token: string, email: string | null }>}
 */
export async function connect(options = {}) {
  const id = getClientId();
  if (!id) {
    throw new Error('Falta la configuración de Google OAuth en la aplicación');
  }
  const { forceConsent = true } = options;
  return connectGoogleCalendar(id, { forceConsent });
}

export function getStoredToken() {
  const token = localStorage.getItem(TOKEN_KEY);
  const expiry = parseInt(localStorage.getItem(TOKEN_EXPIRY_KEY) || '0', 10);
  if (!token || Date.now() > expiry) return null;
  return token;
}

/**
 * If there is a valid access token, returns true.
 * If missing/expired but OAuth was previously linked, tries GIS silent refresh (prompt "").
 * @returns {Promise<boolean>} true if a usable access token is available afterward
 */
export async function ensureGoogleCalendarAccessToken() {
  const id = getClientId();
  if (!id) return false;

  if (getStoredToken()) return true;

  if (!isOAuthLinked()) return false;

  try {
    await loadGISScript();
    await requestAccessTokenWithPrompt(id, '');
    return !!getStoredToken();
  } catch {
    return false;
  }
}

/**
 * Returns a valid access token, attempting silent refresh when needed.
 * @returns {Promise<string|null>}
 */
export async function getAccessTokenForCalendar() {
  const ok = await ensureGoogleCalendarAccessToken();
  return ok ? getStoredToken() : null;
}

export function disconnectGoogleCalendar() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token && window.google?.accounts) {
    try {
      google.accounts.oauth2.revoke(token);
    } catch {
      /* ignore */
    }
  }
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
  localStorage.removeItem(EMAIL_KEY);
  setOAuthLinked(false);
}

export function disconnect() {
  disconnectGoogleCalendar();
}

export function isGoogleCalendarConnected() {
  return !!getStoredToken();
}

/** Alias para pantallas que esperan este nombre */
export const isConnected = isGoogleCalendarConnected;

export async function createCalendarEvent({ title, description, date, contactName }) {
  const token = await getAccessTokenForCalendar();
  if (!token) throw new Error('No hay token de Google Calendar');

  const startDate = normalizeSeguimientoCalendarDay(date);
  if (!startDate) throw new Error('Fecha de seguimiento no válida');

  const event = {
    summary: `Seguimiento: ${contactName} – ${title}`,
    description,
    start: { date: startDate },
    end: { date: exclusiveEndDateForAllDay(startDate) },
  };

  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || 'Error creando evento');
  }
  return res.json();
}

function calendarEventUrl(eventId) {
  return `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`;
}

export async function updateCalendarEvent(eventId, { title, description, date, contactName }) {
  const token = await getAccessTokenForCalendar();
  if (!token) throw new Error('No hay token de Google Calendar');

  const startDate = normalizeSeguimientoCalendarDay(date);
  if (!startDate) throw new Error('Fecha de seguimiento no válida');

  const event = {
    summary: `Seguimiento: ${contactName} – ${title}`,
    description,
    start: { date: startDate },
    end: { date: exclusiveEndDateForAllDay(startDate) },
  };

  const res = await fetch(calendarEventUrl(eventId), {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!res.ok) {
    let message = 'Error actualizando evento';
    try {
      const err = await res.json();
      message = err.error?.message || message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.json();
}

export async function deleteCalendarEvent(eventId) {
  const token = await getAccessTokenForCalendar();
  if (!token) throw new Error('No hay token de Google Calendar');

  const res = await fetch(calendarEventUrl(eventId), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok && res.status !== 410) {
    let message = 'Error eliminando evento';
    try {
      const err = await res.json();
      message = err.error?.message || message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
}
