const SCOPES = 'https://www.googleapis.com/auth/calendar.events';
const TOKEN_KEY = 'gcal_token';
const TOKEN_EXPIRY_KEY = 'gcal_token_expiry';
const CLIENT_ID_KEY = 'gcal_client_id';
const EMAIL_KEY = 'gcal_user_email';

export function getClientId() {
  return localStorage.getItem(CLIENT_ID_KEY) || '';
}

export function saveClientId(clientId) {
  localStorage.setItem(CLIENT_ID_KEY, clientId);
}

export function getConnectedEmail() {
  return localStorage.getItem(EMAIL_KEY) || '';
}

async function fetchUserEmail(accessToken) {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.email || null;
}

let tokenClient = null;
let scriptLoaded = false;

function loadGISScript() {
  return new Promise((resolve, reject) => {
    if (scriptLoaded || window.google?.accounts) {
      scriptLoaded = true;
      return resolve();
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = () => { scriptLoaded = true; resolve(); };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export async function connectGoogleCalendar(clientId) {
  await loadGISScript();

  return new Promise((resolve, reject) => {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: async (response) => {
        if (response.error) return reject(response);
        const expiry = Date.now() + (response.expires_in - 60) * 1000;
        localStorage.setItem(TOKEN_KEY, response.access_token);
        localStorage.setItem(TOKEN_EXPIRY_KEY, expiry.toString());
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
    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

/** @returns {Promise<{ access_token: string, email: string | null }>} */
export async function connect() {
  const id = getClientId();
  if (!id) {
    throw new Error('Configurá el Google Client ID antes de conectar');
  }
  return connectGoogleCalendar(id);
}

export function getStoredToken() {
  const token = localStorage.getItem(TOKEN_KEY);
  const expiry = parseInt(localStorage.getItem(TOKEN_EXPIRY_KEY) || '0');
  if (!token || Date.now() > expiry) return null;
  return token;
}

export function disconnectGoogleCalendar() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token && window.google?.accounts) {
    google.accounts.oauth2.revoke(token);
  }
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
  localStorage.removeItem(EMAIL_KEY);
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
  const token = getStoredToken();
  if (!token) throw new Error('No hay token de Google Calendar');

  const event = {
    summary: `Seguimiento: ${contactName} – ${title}`,
    description,
    start: { date },
    end: { date },
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
