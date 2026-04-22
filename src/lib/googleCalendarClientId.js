/// <reference types="vite/client" />

/**
 * Client ID OAuth 2.0 (tipo Web) para Google Calendar.
 * Es público en el navegador; el secreto no vive en el frontend.
 *
 * Opcional: VITE_GOOGLE_OAUTH_CLIENT_ID en el build (debe ser ID tipo "Aplicación web"
 * y existir en Google Cloud; si está mal, Google responde invalid_client).
 */
const DEFAULT_CLIENT_ID =
  '422575842576-mhsbml05tebltc6ig53sitmv6gtoi8u2.apps.googleusercontent.com';

const WEB_CLIENT_ID_RE = /^\d+-[\w.-]+\.apps\.googleusercontent\.com$/;

function normalizeWebClientId(raw) {
  if (raw == null || typeof raw !== 'string') return '';
  const s = raw.trim().replace(/^["']|["']$/g, '');
  return WEB_CLIENT_ID_RE.test(s) ? s : '';
}

const envRaw = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID;
const fromEnv = normalizeWebClientId(typeof envRaw === 'string' ? envRaw : '');

if (envRaw && !fromEnv) {
  console.warn(
    '[Google OAuth] VITE_GOOGLE_OAUTH_CLIENT_ID no tiene formato válido; se usa el Client ID por defecto de la app.'
  );
}

export const GOOGLE_CALENDAR_OAUTH_CLIENT_ID = fromEnv || DEFAULT_CLIENT_ID;
