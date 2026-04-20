# Pragma CRM Inmobiliario

Frontend Vite + React con datos en **Supabase** (Postgres, Auth, RLS). Las tablas de aplicación usan el prefijo `crm_inmobiliario_` en el esquema `public`.

### Sin migración de datos

Este repositorio **no incluye ni prevé migración de datos** desde otro sistema, CSV, ni desde tablas antiguas sin prefijo. No hay scripts ETL ni `INSERT … SELECT` desde legado: solo definición de esquema (DDL), políticas RLS, funciones y seeds de plantilla para **workspaces nuevos** creados después del deploy. Empezás la base **en cero**; el contenido operativo (leads, ventas, etc.) lo cargás de nuevo en la app o por otros medios que definas fuera de este SQL.

## Requisitos

1. Clonar el repositorio e instalar dependencias: `npm install`
2. Crear un proyecto en [Supabase](https://supabase.com) y aplicar la migración del directorio `supabase/migrations/` (Supabase CLI o pegar el SQL en el **SQL Editor**).

### Base de datos greenfield

La migración asume un proyecto **nuevo** o vacío. Si ya tenías tablas `profiles`, `workspaces`, etc. sin prefijo, conviene un proyecto nuevo o eliminar esos objetos antes de aplicar el SQL actual; **no** se copian datos automáticamente.

### Autenticación (Supabase Dashboard)

En **Authentication → Providers → Email**:

- Desactivar **Confirm email** si querés que los usuarios entren sin verificación por correo (p. ej. tras aceptar una invitación).
- Desactivar **Allow new users to sign up** si el alta es solo por administrador o invitación (recomendado para este flujo).

La pantalla de login de la app solo ofrece inicio de sesión; el alta la gestionás desde Supabase (usuarios invitados) o con la Edge Function de invitaciones.

### Primer administrador de plataforma

Tras crear el primer usuario (Dashboard de Supabase o invitación por correo), ejecutá una vez en el **SQL Editor**:

```sql
UPDATE crm_inmobiliario_profiles
SET is_platform_admin = true
WHERE email = 'tu@email.com';
```

Ese usuario verá **Administración** en el menú y podrá crear equipos (workspaces) y asignar usuarios mediante las funciones RPC definidas en la migración.

### Variables de entorno

Copiá `.env.example` a `.env.local` y completá:

```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon_key>
```

### Edge Function (invitaciones por email)

Desplegá la función `invite-workspace-member` y configurá el secreto `SUPABASE_SERVICE_ROLE_KEY` en el proyecto (invitaciones desde **Miembros del workspace**).

## Desarrollo

`npm run dev`

## Build

`npm run build`
