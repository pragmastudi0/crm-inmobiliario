/**
 * Client ID OAuth 2.0 (tipo Web) para Google Calendar.
 * Es público en el navegador; el secreto no vive en el frontend.
 * Opcional: definir VITE_GOOGLE_OAUTH_CLIENT_ID en el entorno de build para otro proyecto/origen.
 */
const ENV_CLIENT_ID = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID?.trim?.() || '';

const DEFAULT_CLIENT_ID =
  '422575842576-mhsbml05tebltc6ig53sitmv6gtoi8u2.apps.googleusercontent.com';

export const GOOGLE_CALENDAR_OAUTH_CLIENT_ID = ENV_CLIENT_ID || DEFAULT_CLIENT_ID;
