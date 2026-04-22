-- CRM Inmobiliario — esquema greenfield con prefijo crm_inmobiliario_, RLS y admin de plataforma
-- No hay migración de datos desde sistemas anteriores: solo DDL + RLS + funciones.
-- Los INSERT en seed_workspace_template son plantillas para workspaces nuevos, no importación de legado.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.jsonb_get_date(j jsonb, key text)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF j ? key AND NULLIF(trim(j->>key), '') IS NOT NULL THEN
    RETURN (j->>key)::date;
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.jsonb_get_bool(j jsonb, key text, default_val boolean DEFAULT false)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  t text;
BEGIN
  IF j ? key THEN
    t := lower(trim(j->>key));
    IF t IN ('true', 't', '1', 'yes') THEN RETURN true; END IF;
    IF t IN ('false', 'f', '0', 'no', '') THEN RETURN false; END IF;
    RETURN (j->>key)::boolean;
  END IF;
  RETURN default_val;
EXCEPTION WHEN OTHERS THEN
  RETURN default_val;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Core tables
-- ---------------------------------------------------------------------------
CREATE TABLE public.crm_inmobiliario_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  app_slug text NOT NULL DEFAULT 'crm-inmobiliario',
  email text,
  full_name text,
  avatar_url text,
  is_platform_admin boolean NOT NULL DEFAULT false,
  consulta_follow_up_days int NOT NULL DEFAULT 3,
  postventa_follow_up_days int NOT NULL DEFAULT 7,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER crm_inmobiliario_profiles_updated_at
  BEFORE UPDATE ON public.crm_inmobiliario_profiles
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TABLE public.crm_inmobiliario_workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_slug text NOT NULL DEFAULT 'crm-inmobiliario',
  name text NOT NULL DEFAULT 'Mi Workspace',
  owner_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  industry text NOT NULL DEFAULT 'real_estate',
  onboarding_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER crm_inmobiliario_workspaces_updated_at
  BEFORE UPDATE ON public.crm_inmobiliario_workspaces
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TABLE public.crm_inmobiliario_workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_slug text NOT NULL DEFAULT 'crm-inmobiliario',
  workspace_id uuid NOT NULL REFERENCES public.crm_inmobiliario_workspaces (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

CREATE INDEX idx_crm_inmobiliario_wm_user ON public.crm_inmobiliario_workspace_members (user_id);
CREATE INDEX idx_crm_inmobiliario_wm_ws ON public.crm_inmobiliario_workspace_members (workspace_id);

CREATE TABLE public.crm_inmobiliario_workspace_pending_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_slug text NOT NULL DEFAULT 'crm-inmobiliario',
  workspace_id uuid NOT NULL REFERENCES public.crm_inmobiliario_workspaces (id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_crm_inmobiliario_wpi_ws_email
  ON public.crm_inmobiliario_workspace_pending_invites (workspace_id, (lower(email)));

CREATE TABLE public.crm_inmobiliario_workspace_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL UNIQUE REFERENCES public.crm_inmobiliario_workspaces (id) ON DELETE CASCADE,
  currency text NOT NULL DEFAULT 'USD',
  timezone text NOT NULL DEFAULT 'America/Argentina/Cordoba',
  consulta_follow_up_days int NOT NULL DEFAULT 10,
  postventa_follow_up_days int NOT NULL DEFAULT 15,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER crm_inmobiliario_workspace_settings_updated_at
  BEFORE UPDATE ON public.crm_inmobiliario_workspace_settings
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TABLE public.crm_inmobiliario_pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.crm_inmobiliario_workspaces (id) ON DELETE CASCADE,
  nombre text NOT NULL,
  orden int NOT NULL DEFAULT 0,
  color text,
  is_won boolean NOT NULL DEFAULT false,
  is_lost boolean NOT NULL DEFAULT false,
  activa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, nombre)
);

CREATE TRIGGER crm_inmobiliario_pipeline_stages_updated_at
  BEFORE UPDATE ON public.crm_inmobiliario_pipeline_stages
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE INDEX idx_crm_inmobiliario_ps_ws ON public.crm_inmobiliario_pipeline_stages (workspace_id, orden);

CREATE TABLE public.crm_inmobiliario_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.crm_inmobiliario_workspaces (id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'source',
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name)
);

CREATE INDEX idx_crm_inmobiliario_tags_ws ON public.crm_inmobiliario_tags (workspace_id);

CREATE TABLE public.crm_inmobiliario_custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.crm_inmobiliario_workspaces (id) ON DELETE CASCADE,
  entity text NOT NULL,
  key text NOT NULL,
  label text NOT NULL,
  field_type text NOT NULL,
  options jsonb,
  orden int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, key)
);

CREATE TABLE public.crm_inmobiliario_listas_whatsapp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.crm_inmobiliario_workspaces (id) ON DELETE CASCADE,
  doc jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER crm_inmobiliario_listas_whatsapp_updated_at
  BEFORE UPDATE ON public.crm_inmobiliario_listas_whatsapp
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE INDEX idx_crm_inmobiliario_listas_ws ON public.crm_inmobiliario_listas_whatsapp (workspace_id);

CREATE TABLE public.crm_inmobiliario_plantillas_whatsapp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.crm_inmobiliario_workspaces (id) ON DELETE CASCADE,
  doc jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER crm_inmobiliario_plantillas_whatsapp_updated_at
  BEFORE UPDATE ON public.crm_inmobiliario_plantillas_whatsapp
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE INDEX idx_crm_inmobiliario_plantillas_ws ON public.crm_inmobiliario_plantillas_whatsapp (workspace_id);

CREATE TABLE public.crm_inmobiliario_variable_plantilla (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.crm_inmobiliario_workspaces (id) ON DELETE CASCADE,
  doc jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER crm_inmobiliario_variable_plantilla_updated_at
  BEFORE UPDATE ON public.crm_inmobiliario_variable_plantilla
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE INDEX idx_crm_inmobiliario_var_plant_ws ON public.crm_inmobiliario_variable_plantilla (workspace_id);

CREATE TABLE public.crm_inmobiliario_consultas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.crm_inmobiliario_workspaces (id) ON DELETE CASCADE,
  doc jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER crm_inmobiliario_consultas_updated_at
  BEFORE UPDATE ON public.crm_inmobiliario_consultas
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE INDEX idx_crm_inmobiliario_consultas_ws ON public.crm_inmobiliario_consultas (workspace_id, created_at DESC);

CREATE TABLE public.crm_inmobiliario_contactos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.crm_inmobiliario_workspaces (id) ON DELETE CASCADE,
  doc jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER crm_inmobiliario_contactos_updated_at
  BEFORE UPDATE ON public.crm_inmobiliario_contactos
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE INDEX idx_crm_inmobiliario_contactos_ws ON public.crm_inmobiliario_contactos (workspace_id, created_at DESC);

CREATE TABLE public.crm_inmobiliario_ventas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.crm_inmobiliario_workspaces (id) ON DELETE CASCADE,
  doc jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  fecha date GENERATED ALWAYS AS (public.jsonb_get_date(doc, 'fecha')) STORED,
  codigo text GENERATED ALWAYS AS ((doc->>'codigo')) STORED,
  postventa_activa boolean GENERATED ALWAYS AS (public.jsonb_get_bool(doc, 'postventaActiva', false)) STORED,
  proximo_seguimiento_postventa date GENERATED ALWAYS AS (public.jsonb_get_date(doc, 'proximoSeguimientoPostventa')) STORED
);

CREATE TRIGGER crm_inmobiliario_ventas_updated_at
  BEFORE UPDATE ON public.crm_inmobiliario_ventas
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE INDEX idx_crm_inmobiliario_ventas_ws_fecha ON public.crm_inmobiliario_ventas (workspace_id, fecha DESC NULLS LAST);
CREATE INDEX idx_crm_inmobiliario_ventas_ws_created ON public.crm_inmobiliario_ventas (workspace_id, created_at DESC);
CREATE INDEX idx_crm_inmobiliario_ventas_postventa ON public.crm_inmobiliario_ventas (workspace_id, postventa_activa, proximo_seguimiento_postventa NULLS LAST);

CREATE TABLE public.crm_inmobiliario_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.crm_inmobiliario_workspaces (id) ON DELETE CASCADE,
  doc jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER crm_inmobiliario_properties_updated_at
  BEFORE UPDATE ON public.crm_inmobiliario_properties
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE INDEX idx_crm_inmobiliario_properties_ws ON public.crm_inmobiliario_properties (workspace_id, created_at DESC);

CREATE TABLE public.crm_inmobiliario_proveedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.crm_inmobiliario_workspaces (id) ON DELETE CASCADE,
  doc jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER crm_inmobiliario_proveedores_updated_at
  BEFORE UPDATE ON public.crm_inmobiliario_proveedores
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE INDEX idx_crm_inmobiliario_proveedores_ws ON public.crm_inmobiliario_proveedores (workspace_id, created_at DESC);

CREATE TABLE public.crm_inmobiliario_envios_whatsapp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.crm_inmobiliario_workspaces (id) ON DELETE CASCADE,
  doc jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_inmobiliario_envios_ws ON public.crm_inmobiliario_envios_whatsapp (workspace_id, created_at DESC);

CREATE TABLE public.crm_inmobiliario_mensajes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.crm_inmobiliario_workspaces (id) ON DELETE CASCADE,
  doc jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_inmobiliario_mensajes_ws ON public.crm_inmobiliario_mensajes (workspace_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Auth trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crm_inmobiliario_app_slug()
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 'crm-inmobiliario'::text;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  app_slug_const text := public.crm_inmobiliario_app_slug();
  can_attach_to_crm boolean := false;
BEGIN
  can_attach_to_crm := COALESCE(lower(NEW.raw_user_meta_data->>'app_slug') = lower(app_slug_const), false)
    OR EXISTS (
      SELECT 1
      FROM public.crm_inmobiliario_workspace_pending_invites pi
      WHERE lower(pi.email) = lower(NEW.email)
        AND pi.app_slug = app_slug_const
    );

  IF can_attach_to_crm THEN
    INSERT INTO public.crm_inmobiliario_profiles (id, app_slug, email, full_name)
    VALUES (
      NEW.id,
      app_slug_const,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
    )
    ON CONFLICT (id) DO UPDATE SET
      app_slug = EXCLUDED.app_slug,
      email = EXCLUDED.email,
      full_name = COALESCE(EXCLUDED.full_name, public.crm_inmobiliario_profiles.full_name);
  END IF;

  INSERT INTO public.crm_inmobiliario_workspace_members (app_slug, workspace_id, user_id, role)
  SELECT app_slug_const, pi.workspace_id, NEW.id, pi.role
  FROM public.crm_inmobiliario_workspace_pending_invites pi
  WHERE lower(pi.email) = lower(NEW.email)
    AND pi.app_slug = app_slug_const;

  DELETE FROM public.crm_inmobiliario_workspace_pending_invites
  WHERE lower(email) = lower(NEW.email)
    AND app_slug = app_slug_const;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_pragma ON auth.users;
CREATE TRIGGER on_auth_user_created_pragma
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT p.is_platform_admin
      FROM public.crm_inmobiliario_profiles p
      WHERE p.id = auth.uid()
        AND p.app_slug = public.crm_inmobiliario_app_slug()
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.user_workspace_ids()
RETURNS setof uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT wm.workspace_id
  FROM public.crm_inmobiliario_workspace_members wm
  JOIN public.crm_inmobiliario_workspaces w ON w.id = wm.workspace_id
  WHERE wm.user_id = auth.uid()
    AND wm.app_slug = public.crm_inmobiliario_app_slug()
    AND w.app_slug = public.crm_inmobiliario_app_slug();
$$;

ALTER TABLE public.crm_inmobiliario_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_inmobiliario_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_inmobiliario_workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_inmobiliario_workspace_pending_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_inmobiliario_workspace_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_inmobiliario_pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_inmobiliario_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_inmobiliario_custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_inmobiliario_listas_whatsapp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_inmobiliario_plantillas_whatsapp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_inmobiliario_variable_plantilla ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_inmobiliario_consultas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_inmobiliario_contactos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_inmobiliario_ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_inmobiliario_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_inmobiliario_proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_inmobiliario_envios_whatsapp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_inmobiliario_mensajes ENABLE ROW LEVEL SECURITY;

CREATE POLICY crm_inm_profiles_select ON public.crm_inmobiliario_profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.current_is_platform_admin());

CREATE POLICY crm_inm_profiles_update ON public.crm_inmobiliario_profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY crm_inm_workspaces_select ON public.crm_inmobiliario_workspaces FOR SELECT TO authenticated
  USING (id IN (SELECT public.user_workspace_ids()) OR public.current_is_platform_admin());

CREATE POLICY crm_inm_workspaces_update ON public.crm_inmobiliario_workspaces FOR UPDATE TO authenticated
  USING (id IN (SELECT public.user_workspace_ids()) OR public.current_is_platform_admin())
  WITH CHECK (id IN (SELECT public.user_workspace_ids()) OR public.current_is_platform_admin());

CREATE POLICY crm_inm_wm_select ON public.crm_inmobiliario_workspace_members FOR SELECT TO authenticated
  USING (
    (
      app_slug = public.crm_inmobiliario_app_slug()
      AND workspace_id IN (SELECT public.user_workspace_ids())
    )
    OR public.current_is_platform_admin()
  );

CREATE POLICY crm_inm_wm_insert ON public.crm_inmobiliario_workspace_members FOR INSERT TO authenticated
  WITH CHECK (
    app_slug = public.crm_inmobiliario_app_slug()
    AND (
      workspace_id IN (
        SELECT wm.workspace_id FROM public.crm_inmobiliario_workspace_members wm
        WHERE wm.user_id = auth.uid()
          AND wm.role = 'admin'
          AND wm.app_slug = public.crm_inmobiliario_app_slug()
      )
      OR public.current_is_platform_admin()
    )
  );

CREATE POLICY crm_inm_wm_update ON public.crm_inmobiliario_workspace_members FOR UPDATE TO authenticated
  USING (
    app_slug = public.crm_inmobiliario_app_slug()
    AND (
      workspace_id IN (
        SELECT wm.workspace_id FROM public.crm_inmobiliario_workspace_members wm
        WHERE wm.user_id = auth.uid()
          AND wm.role = 'admin'
          AND wm.app_slug = public.crm_inmobiliario_app_slug()
      )
      OR public.current_is_platform_admin()
    )
  )
  WITH CHECK (
    app_slug = public.crm_inmobiliario_app_slug()
    AND (
      workspace_id IN (
        SELECT wm.workspace_id FROM public.crm_inmobiliario_workspace_members wm
        WHERE wm.user_id = auth.uid()
          AND wm.role = 'admin'
          AND wm.app_slug = public.crm_inmobiliario_app_slug()
      )
      OR public.current_is_platform_admin()
    )
  );

CREATE POLICY crm_inm_wm_delete ON public.crm_inmobiliario_workspace_members FOR DELETE TO authenticated
  USING (
    app_slug = public.crm_inmobiliario_app_slug()
    AND (
      workspace_id IN (
        SELECT wm.workspace_id FROM public.crm_inmobiliario_workspace_members wm
        WHERE wm.user_id = auth.uid()
          AND wm.role = 'admin'
          AND wm.app_slug = public.crm_inmobiliario_app_slug()
      )
      OR public.current_is_platform_admin()
    )
  );

CREATE POLICY crm_inm_wpi_select ON public.crm_inmobiliario_workspace_pending_invites FOR SELECT TO authenticated
  USING (
    (
      app_slug = public.crm_inmobiliario_app_slug()
      AND workspace_id IN (
        SELECT wm.workspace_id FROM public.crm_inmobiliario_workspace_members wm
        WHERE wm.user_id = auth.uid() AND wm.role = 'admin' AND wm.app_slug = public.crm_inmobiliario_app_slug()
      )
    )
    OR public.current_is_platform_admin()
  );

CREATE POLICY crm_inm_wpi_insert ON public.crm_inmobiliario_workspace_pending_invites FOR INSERT TO authenticated
  WITH CHECK (
    (
      app_slug = public.crm_inmobiliario_app_slug()
      AND workspace_id IN (
        SELECT wm.workspace_id FROM public.crm_inmobiliario_workspace_members wm
        WHERE wm.user_id = auth.uid() AND wm.role = 'admin' AND wm.app_slug = public.crm_inmobiliario_app_slug()
      )
    )
    OR public.current_is_platform_admin()
  );

CREATE POLICY crm_inm_wpi_delete ON public.crm_inmobiliario_workspace_pending_invites FOR DELETE TO authenticated
  USING (
    (
      app_slug = public.crm_inmobiliario_app_slug()
      AND workspace_id IN (
        SELECT wm.workspace_id FROM public.crm_inmobiliario_workspace_members wm
        WHERE wm.user_id = auth.uid() AND wm.role = 'admin' AND wm.app_slug = public.crm_inmobiliario_app_slug()
      )
    )
    OR public.current_is_platform_admin()
  );

CREATE POLICY crm_inm_ws_settings_rw ON public.crm_inmobiliario_workspace_settings FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.user_workspace_ids()) OR public.current_is_platform_admin())
  WITH CHECK (workspace_id IN (SELECT public.user_workspace_ids()) OR public.current_is_platform_admin());

CREATE POLICY crm_inm_pipeline_rw ON public.crm_inmobiliario_pipeline_stages FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.user_workspace_ids()) OR public.current_is_platform_admin())
  WITH CHECK (workspace_id IN (SELECT public.user_workspace_ids()) OR public.current_is_platform_admin());

CREATE POLICY crm_inm_tags_rw ON public.crm_inmobiliario_tags FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.user_workspace_ids()) OR public.current_is_platform_admin())
  WITH CHECK (workspace_id IN (SELECT public.user_workspace_ids()) OR public.current_is_platform_admin());

CREATE POLICY crm_inm_cf_rw ON public.crm_inmobiliario_custom_fields FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.user_workspace_ids()) OR public.current_is_platform_admin())
  WITH CHECK (workspace_id IN (SELECT public.user_workspace_ids()) OR public.current_is_platform_admin());

CREATE POLICY crm_inm_listas_rw ON public.crm_inmobiliario_listas_whatsapp FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.user_workspace_ids()) OR public.current_is_platform_admin())
  WITH CHECK (workspace_id IN (SELECT public.user_workspace_ids()) OR public.current_is_platform_admin());

CREATE POLICY crm_inm_plantillas_rw ON public.crm_inmobiliario_plantillas_whatsapp FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.user_workspace_ids()) OR public.current_is_platform_admin())
  WITH CHECK (workspace_id IN (SELECT public.user_workspace_ids()) OR public.current_is_platform_admin());

CREATE POLICY crm_inm_var_plant_rw ON public.crm_inmobiliario_variable_plantilla FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.user_workspace_ids()) OR public.current_is_platform_admin())
  WITH CHECK (workspace_id IN (SELECT public.user_workspace_ids()) OR public.current_is_platform_admin());

CREATE POLICY crm_inm_consultas_rw ON public.crm_inmobiliario_consultas FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.user_workspace_ids()) OR public.current_is_platform_admin())
  WITH CHECK (workspace_id IN (SELECT public.user_workspace_ids()) OR public.current_is_platform_admin());

CREATE POLICY crm_inm_contactos_rw ON public.crm_inmobiliario_contactos FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.user_workspace_ids()) OR public.current_is_platform_admin())
  WITH CHECK (workspace_id IN (SELECT public.user_workspace_ids()) OR public.current_is_platform_admin());

CREATE POLICY crm_inm_ventas_rw ON public.crm_inmobiliario_ventas FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.user_workspace_ids()) OR public.current_is_platform_admin())
  WITH CHECK (workspace_id IN (SELECT public.user_workspace_ids()) OR public.current_is_platform_admin());

CREATE POLICY crm_inm_properties_rw ON public.crm_inmobiliario_properties FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.user_workspace_ids()) OR public.current_is_platform_admin())
  WITH CHECK (workspace_id IN (SELECT public.user_workspace_ids()) OR public.current_is_platform_admin());

CREATE POLICY crm_inm_proveedores_rw ON public.crm_inmobiliario_proveedores FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.user_workspace_ids()) OR public.current_is_platform_admin())
  WITH CHECK (workspace_id IN (SELECT public.user_workspace_ids()) OR public.current_is_platform_admin());

CREATE POLICY crm_inm_envios_rw ON public.crm_inmobiliario_envios_whatsapp FOR ALL TO authenticated
  USING (
    workspace_id IS NULL
    OR workspace_id IN (SELECT public.user_workspace_ids())
    OR public.current_is_platform_admin()
  )
  WITH CHECK (
    workspace_id IS NULL
    OR workspace_id IN (SELECT public.user_workspace_ids())
    OR public.current_is_platform_admin()
  );

CREATE POLICY crm_inm_mensajes_rw ON public.crm_inmobiliario_mensajes FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.user_workspace_ids()) OR public.current_is_platform_admin())
  WITH CHECK (workspace_id IN (SELECT public.user_workspace_ids()) OR public.current_is_platform_admin());

-- ---------------------------------------------------------------------------
-- Seed template
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_workspace_template(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s record;
BEGIN
  FOR s IN SELECT * FROM (VALUES
    ('Nuevo lead', 1, 'bg-blue-500', false, false),
    ('Contactado', 2, 'bg-cyan-500', false, false),
    ('Visita agendada', 3, 'bg-violet-500', false, false),
    ('Visita realizada', 4, 'bg-amber-500', false, false),
    ('En negociación', 5, 'bg-orange-500', false, false),
    ('Reserva firmada', 6, 'bg-purple-500', false, false),
    ('Operación cerrada', 7, 'bg-emerald-500', true, false),
    ('No concretado', 8, 'bg-red-500', false, true)
  ) AS t(nombre, orden, color, is_won, is_lost)
  LOOP
    INSERT INTO public.crm_inmobiliario_pipeline_stages (workspace_id, nombre, orden, color, is_won, is_lost, activa)
    VALUES (p_workspace_id, s.nombre, s.orden, s.color, s.is_won, s.is_lost, true)
    ON CONFLICT (workspace_id, nombre) DO UPDATE SET
      orden = EXCLUDED.orden, color = EXCLUDED.color, is_won = EXCLUDED.is_won,
      is_lost = EXCLUDED.is_lost, activa = true, updated_at = now();
  END LOOP;

  UPDATE public.crm_inmobiliario_pipeline_stages SET activa = false, updated_at = now()
  WHERE workspace_id = p_workspace_id
    AND nombre NOT IN (
      'Nuevo lead','Contactado','Visita agendada','Visita realizada','En negociación',
      'Reserva firmada','Operación cerrada','No concretado'
    );

  INSERT INTO public.crm_inmobiliario_tags (workspace_id, name, type) VALUES
    (p_workspace_id, 'Zona Prop', 'source'),
    (p_workspace_id, 'La voz del interior', 'source'),
    (p_workspace_id, 'Facebook', 'source'),
    (p_workspace_id, 'Instagram', 'source'),
    (p_workspace_id, 'Estado WhatsApp', 'source'),
    (p_workspace_id, 'Referido', 'source'),
    (p_workspace_id, 'Argenprop', 'source'),
    (p_workspace_id, 'MercadoLibre', 'source'),
    (p_workspace_id, 'La Voz del Interior', 'source'),
    (p_workspace_id, 'Cartel en propiedad', 'source'),
    (p_workspace_id, 'Vitrina', 'source'),
    (p_workspace_id, 'Base de datos propia', 'source'),
    (p_workspace_id, 'Otro', 'source'),
    (p_workspace_id, 'Venta', 'operation'),
    (p_workspace_id, 'Alquiler', 'operation'),
    (p_workspace_id, 'Alquiler temporal', 'operation'),
    (p_workspace_id, 'Departamento', 'property_type'),
    (p_workspace_id, 'Casa', 'property_type'),
    (p_workspace_id, 'Lote', 'property_type'),
    (p_workspace_id, 'Oficina', 'property_type'),
    (p_workspace_id, 'Local', 'property_type'),
    (p_workspace_id, 'Galpón', 'property_type'),
    (p_workspace_id, 'Nueva Córdoba', 'zone'),
    (p_workspace_id, 'Centro', 'zone'),
    (p_workspace_id, 'General Paz', 'zone'),
    (p_workspace_id, 'Cerro', 'zone'),
    (p_workspace_id, 'Güemes', 'zone'),
    (p_workspace_id, 'Zona Norte', 'zone'),
    (p_workspace_id, 'Alta', 'priority'),
    (p_workspace_id, 'Media', 'priority'),
    (p_workspace_id, 'Baja', 'priority')
  ON CONFLICT (workspace_id, name) DO NOTHING;

  INSERT INTO public.crm_inmobiliario_custom_fields (workspace_id, entity, key, label, field_type, options, orden) VALUES
    (p_workspace_id, 'lead', 'operacion', 'Operación', 'select', '["Venta","Alquiler","Alquiler temporal"]'::jsonb, 1),
    (p_workspace_id, 'lead', 'tipo_propiedad', 'Tipo de propiedad', 'select', '["Departamento","Casa","Duplex","Lote","Oficina","Local","Campo"]'::jsonb, 2),
    (p_workspace_id, 'lead', 'zona_preferida', 'Zona preferida', 'multiselect', '["Nueva Córdoba","Centro","General Paz","Cerro","Güemes","Zona Norte"]'::jsonb, 3),
    (p_workspace_id, 'lead', 'presupuesto', 'Presupuesto', 'currency', null, 4),
    (p_workspace_id, 'lead', 'moneda_pres', 'Moneda', 'select', '["USD","ARS"]'::jsonb, 5),
    (p_workspace_id, 'lead', 'ambientes_min', 'Ambientes mín.', 'number', null, 6),
    (p_workspace_id, 'lead', 'dormitorios_min', 'Dormitorios mín.', 'number', null, 7),
    (p_workspace_id, 'lead', 'cochera', '¿Requiere cochera?', 'boolean', null, 8),
    (p_workspace_id, 'lead', 'fecha_mudanza', 'Fecha de mudanza', 'date', null, 9),
    (p_workspace_id, 'lead', 'forma_pago', 'Forma de pago', 'select', '["Efectivo","Hipotecario","Permuta"]'::jsonb, 10),
    (p_workspace_id, 'lead', 'tiene_permuta', '¿Tiene propiedad para permuta?', 'boolean', null, 11),
    (p_workspace_id, 'lead', 'observaciones', 'Observaciones', 'text', null, 12)
  ON CONFLICT (workspace_id, key) DO NOTHING;

  DELETE FROM public.crm_inmobiliario_listas_whatsapp WHERE workspace_id = p_workspace_id;

  INSERT INTO public.crm_inmobiliario_listas_whatsapp (workspace_id, doc) VALUES
    (p_workspace_id, '{"nombre":"Bienvenida consulta inmobiliaria","categoria":"General","estado":"Publicada","tags":["nuevo","bienvenida"],"texto":"Hola, gracias por contactarnos. Somos una inmobiliaria con experiencia en la zona. Contanos en que podemos ayudarte."}'::jsonb),
    (p_workspace_id, '{"nombre":"Propiedades disponibles en venta","categoria":"Venta","estado":"Publicada","tags":["venta","propiedades"],"texto":"Propiedades en venta actualizadas. Indicanos zona, ambientes, presupuesto y forma de pago para armarte una seleccion."}'::jsonb),
    (p_workspace_id, '{"nombre":"Propiedades disponibles en alquiler","categoria":"Alquiler","estado":"Publicada","tags":["alquiler","propiedades"],"texto":"Propiedades en alquiler. Indicanos zona, ambientes, presupuesto mensual y fecha de ingreso estimada."}'::jsonb),
    (p_workspace_id, '{"nombre":"Confirmacion de visita","categoria":"General","estado":"Publicada","tags":["visita"],"texto":"Te confirmamos la visita. Propiedad: {PROPIEDAD}. Fecha: {FECHA}. Hora: {HORA}. Te atiende: {VENDEDOR}."}'::jsonb),
    (p_workspace_id, '{"nombre":"Seguimiento post-visita","categoria":"General","estado":"Publicada","tags":["seguimiento","visita"],"texto":"Hola, que te parecio la propiedad? Contanos si queres ver otras opciones."}'::jsonb),
    (p_workspace_id, '{"nombre":"Cierre y proximos pasos","categoria":"General","estado":"Publicada","tags":["cierre"],"texto":"Te confirmamos que avanzamos con la operacion. Propiedad: {PROPIEDAD}. Valor: {PRECIO} {MONEDA}. Proximos pasos: reserva, documentacion, escritura."}'::jsonb);

  INSERT INTO public.crm_inmobiliario_workspace_settings (workspace_id, currency, timezone, consulta_follow_up_days, postventa_follow_up_days)
  VALUES (p_workspace_id, 'USD', 'America/Argentina/Cordoba', 10, 15)
  ON CONFLICT (workspace_id) DO UPDATE SET
    currency = EXCLUDED.currency,
    timezone = EXCLUDED.timezone,
    consulta_follow_up_days = EXCLUDED.consulta_follow_up_days,
    postventa_follow_up_days = EXCLUDED.postventa_follow_up_days,
    updated_at = now();

  UPDATE public.crm_inmobiliario_workspaces SET industry = 'real_estate', onboarding_completed = true, updated_at = now()
  WHERE id = p_workspace_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_workspace()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  wid uuid;
  done boolean;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT wm.workspace_id INTO wid
  FROM public.crm_inmobiliario_workspace_members wm
  JOIN public.crm_inmobiliario_workspaces w ON w.id = wm.workspace_id
  WHERE wm.user_id = uid
    AND wm.app_slug = public.crm_inmobiliario_app_slug()
    AND w.app_slug = public.crm_inmobiliario_app_slug()
  ORDER BY CASE WHEN wm.role = 'admin' THEN 0 ELSE 1 END, wm.created_at
  LIMIT 1;

  IF wid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT onboarding_completed INTO done FROM public.crm_inmobiliario_workspaces WHERE id = wid;
  IF NOT COALESCE(done, false) THEN
    PERFORM public.seed_workspace_template(wid);
  END IF;
  RETURN wid;
END;
$$;

-- ---------------------------------------------------------------------------
-- Platform admin RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crm_inmobiliario_admin_list_workspaces()
RETURNS SETOF public.crm_inmobiliario_workspaces
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT *
  FROM public.crm_inmobiliario_workspaces
  WHERE app_slug = public.crm_inmobiliario_app_slug()
  ORDER BY created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.crm_inmobiliario_admin_list_users_without_workspace()
RETURNS SETOF public.crm_inmobiliario_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT p.*
  FROM public.crm_inmobiliario_profiles p
  WHERE p.app_slug = public.crm_inmobiliario_app_slug()
    AND NOT EXISTS (
    SELECT 1
    FROM public.crm_inmobiliario_workspace_members m
    WHERE m.user_id = p.id
      AND m.app_slug = public.crm_inmobiliario_app_slug()
  )
  ORDER BY p.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.crm_inmobiliario_admin_create_workspace(p_name text, p_owner_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wid uuid;
BEGIN
  IF NOT public.current_is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'invalid name';
  END IF;
  IF p_owner_user_id IS NULL THEN
    RAISE EXCEPTION 'owner required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.crm_inmobiliario_profiles p
    WHERE p.id = p_owner_user_id
      AND p.app_slug = public.crm_inmobiliario_app_slug()
  ) THEN
    RAISE EXCEPTION 'owner does not belong to crm-inmobiliario';
  END IF;

  INSERT INTO public.crm_inmobiliario_workspaces (app_slug, name, owner_user_id, industry, onboarding_completed)
  VALUES (public.crm_inmobiliario_app_slug(), trim(p_name), p_owner_user_id, 'real_estate', false)
  RETURNING id INTO wid;

  INSERT INTO public.crm_inmobiliario_workspace_members (app_slug, workspace_id, user_id, role)
  VALUES (public.crm_inmobiliario_app_slug(), wid, p_owner_user_id, 'admin');

  PERFORM public.seed_workspace_template(wid);
  RETURN wid;
END;
$$;

CREATE OR REPLACE FUNCTION public.crm_inmobiliario_admin_add_member(p_workspace_id uuid, p_user_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r text;
BEGIN
  IF NOT public.current_is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_workspace_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid arguments';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.crm_inmobiliario_workspaces w
    WHERE w.id = p_workspace_id
      AND w.app_slug = public.crm_inmobiliario_app_slug()
  ) THEN
    RAISE EXCEPTION 'workspace does not belong to crm-inmobiliario';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.crm_inmobiliario_profiles p
    WHERE p.id = p_user_id
      AND p.app_slug = public.crm_inmobiliario_app_slug()
  ) THEN
    RAISE EXCEPTION 'user does not belong to crm-inmobiliario';
  END IF;
  r := CASE WHEN lower(trim(p_role)) = 'admin' THEN 'admin' ELSE 'member' END;

  INSERT INTO public.crm_inmobiliario_workspace_members (app_slug, workspace_id, user_id, role)
  VALUES (public.crm_inmobiliario_app_slug(), p_workspace_id, p_user_id, r)
  ON CONFLICT (workspace_id, user_id) DO UPDATE SET
    role = EXCLUDED.role,
    app_slug = EXCLUDED.app_slug;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_workspace() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_workspace_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_inmobiliario_admin_list_workspaces() TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_inmobiliario_admin_list_users_without_workspace() TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_inmobiliario_admin_create_workspace(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_inmobiliario_admin_add_member(uuid, uuid, text) TO authenticated;
