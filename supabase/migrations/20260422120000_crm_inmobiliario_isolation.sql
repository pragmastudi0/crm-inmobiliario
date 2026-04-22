-- Aislamiento de datos para crm-inmobiliario en proyecto Supabase compartido
-- - Refuerza RLS en workspace_members
-- - Introduce/normaliza app_slug
-- - Ajusta funciones/RPC para scope de app

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) App slug helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crm_inmobiliario_app_slug()
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 'crm-inmobiliario'::text;
$$;

-- ---------------------------------------------------------------------------
-- 2) Columnas app_slug en tablas núcleo (idempotente)
-- ---------------------------------------------------------------------------
ALTER TABLE public.crm_inmobiliario_profiles
  ADD COLUMN IF NOT EXISTS app_slug text;
ALTER TABLE public.crm_inmobiliario_workspaces
  ADD COLUMN IF NOT EXISTS app_slug text;
ALTER TABLE public.crm_inmobiliario_workspace_members
  ADD COLUMN IF NOT EXISTS app_slug text;
ALTER TABLE public.crm_inmobiliario_workspace_pending_invites
  ADD COLUMN IF NOT EXISTS app_slug text;

UPDATE public.crm_inmobiliario_profiles
SET app_slug = public.crm_inmobiliario_app_slug()
WHERE app_slug IS NULL OR trim(app_slug) = '';

UPDATE public.crm_inmobiliario_workspaces
SET app_slug = public.crm_inmobiliario_app_slug()
WHERE app_slug IS NULL OR trim(app_slug) = '';

UPDATE public.crm_inmobiliario_workspace_members
SET app_slug = public.crm_inmobiliario_app_slug()
WHERE app_slug IS NULL OR trim(app_slug) = '';

UPDATE public.crm_inmobiliario_workspace_pending_invites
SET app_slug = public.crm_inmobiliario_app_slug()
WHERE app_slug IS NULL OR trim(app_slug) = '';

ALTER TABLE public.crm_inmobiliario_profiles
  ALTER COLUMN app_slug SET DEFAULT 'crm-inmobiliario';
ALTER TABLE public.crm_inmobiliario_workspaces
  ALTER COLUMN app_slug SET DEFAULT 'crm-inmobiliario';
ALTER TABLE public.crm_inmobiliario_workspace_members
  ALTER COLUMN app_slug SET DEFAULT 'crm-inmobiliario';
ALTER TABLE public.crm_inmobiliario_workspace_pending_invites
  ALTER COLUMN app_slug SET DEFAULT 'crm-inmobiliario';

ALTER TABLE public.crm_inmobiliario_profiles
  ALTER COLUMN app_slug SET NOT NULL;
ALTER TABLE public.crm_inmobiliario_workspaces
  ALTER COLUMN app_slug SET NOT NULL;
ALTER TABLE public.crm_inmobiliario_workspace_members
  ALTER COLUMN app_slug SET NOT NULL;
ALTER TABLE public.crm_inmobiliario_workspace_pending_invites
  ALTER COLUMN app_slug SET NOT NULL;

-- Índices auxiliares para filtros por app
CREATE INDEX IF NOT EXISTS idx_crm_inmobiliario_profiles_app_slug
  ON public.crm_inmobiliario_profiles (app_slug);
CREATE INDEX IF NOT EXISTS idx_crm_inmobiliario_workspaces_app_slug
  ON public.crm_inmobiliario_workspaces (app_slug);
CREATE INDEX IF NOT EXISTS idx_crm_inmobiliario_wm_app_slug
  ON public.crm_inmobiliario_workspace_members (app_slug);
CREATE INDEX IF NOT EXISTS idx_crm_inmobiliario_wpi_app_slug
  ON public.crm_inmobiliario_workspace_pending_invites (app_slug);

-- ---------------------------------------------------------------------------
-- 3) Funciones de contexto de seguridad (scope por app)
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
RETURNS SETOF uuid
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

  SELECT onboarding_completed INTO done
  FROM public.crm_inmobiliario_workspaces
  WHERE id = wid;

  IF NOT COALESCE(done, false) THEN
    PERFORM public.seed_workspace_template(wid);
  END IF;

  RETURN wid;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4) Trigger de alta de usuario (solo ingresa al dominio CRM cuando aplica)
-- ---------------------------------------------------------------------------
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
    AND pi.app_slug = app_slug_const
  ON CONFLICT (workspace_id, user_id) DO UPDATE SET
    role = EXCLUDED.role,
    app_slug = EXCLUDED.app_slug;

  DELETE FROM public.crm_inmobiliario_workspace_pending_invites
  WHERE lower(email) = lower(NEW.email)
    AND app_slug = app_slug_const;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5) RLS: membresías con permisos de escritura solo admin/platform-admin
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS crm_inm_wm_rw ON public.crm_inmobiliario_workspace_members;
DROP POLICY IF EXISTS crm_inm_wm_select ON public.crm_inmobiliario_workspace_members;
DROP POLICY IF EXISTS crm_inm_wm_insert ON public.crm_inmobiliario_workspace_members;
DROP POLICY IF EXISTS crm_inm_wm_update ON public.crm_inmobiliario_workspace_members;
DROP POLICY IF EXISTS crm_inm_wm_delete ON public.crm_inmobiliario_workspace_members;

CREATE POLICY crm_inm_wm_select
ON public.crm_inmobiliario_workspace_members
FOR SELECT
TO authenticated
USING (
  (
    app_slug = public.crm_inmobiliario_app_slug()
    AND workspace_id IN (SELECT public.user_workspace_ids())
  )
  OR public.current_is_platform_admin()
);

CREATE POLICY crm_inm_wm_insert
ON public.crm_inmobiliario_workspace_members
FOR INSERT
TO authenticated
WITH CHECK (
  app_slug = public.crm_inmobiliario_app_slug()
  AND (
    workspace_id IN (
      SELECT wm.workspace_id
      FROM public.crm_inmobiliario_workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.role = 'admin'
        AND wm.app_slug = public.crm_inmobiliario_app_slug()
    )
    OR public.current_is_platform_admin()
  )
);

CREATE POLICY crm_inm_wm_update
ON public.crm_inmobiliario_workspace_members
FOR UPDATE
TO authenticated
USING (
  app_slug = public.crm_inmobiliario_app_slug()
  AND (
    workspace_id IN (
      SELECT wm.workspace_id
      FROM public.crm_inmobiliario_workspace_members wm
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
      SELECT wm.workspace_id
      FROM public.crm_inmobiliario_workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.role = 'admin'
        AND wm.app_slug = public.crm_inmobiliario_app_slug()
    )
    OR public.current_is_platform_admin()
  )
);

CREATE POLICY crm_inm_wm_delete
ON public.crm_inmobiliario_workspace_members
FOR DELETE
TO authenticated
USING (
  app_slug = public.crm_inmobiliario_app_slug()
  AND (
    workspace_id IN (
      SELECT wm.workspace_id
      FROM public.crm_inmobiliario_workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.role = 'admin'
        AND wm.app_slug = public.crm_inmobiliario_app_slug()
    )
    OR public.current_is_platform_admin()
  )
);

-- ---------------------------------------------------------------------------
-- 6) RLS: pending invites con scope por app
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS crm_inm_wpi_select ON public.crm_inmobiliario_workspace_pending_invites;
DROP POLICY IF EXISTS crm_inm_wpi_insert ON public.crm_inmobiliario_workspace_pending_invites;
DROP POLICY IF EXISTS crm_inm_wpi_delete ON public.crm_inmobiliario_workspace_pending_invites;

CREATE POLICY crm_inm_wpi_select
ON public.crm_inmobiliario_workspace_pending_invites
FOR SELECT
TO authenticated
USING (
  (
    app_slug = public.crm_inmobiliario_app_slug()
    AND workspace_id IN (
      SELECT wm.workspace_id
      FROM public.crm_inmobiliario_workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.role = 'admin'
        AND wm.app_slug = public.crm_inmobiliario_app_slug()
    )
  )
  OR public.current_is_platform_admin()
);

CREATE POLICY crm_inm_wpi_insert
ON public.crm_inmobiliario_workspace_pending_invites
FOR INSERT
TO authenticated
WITH CHECK (
  (
    app_slug = public.crm_inmobiliario_app_slug()
    AND workspace_id IN (
      SELECT wm.workspace_id
      FROM public.crm_inmobiliario_workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.role = 'admin'
        AND wm.app_slug = public.crm_inmobiliario_app_slug()
    )
  )
  OR public.current_is_platform_admin()
);

CREATE POLICY crm_inm_wpi_delete
ON public.crm_inmobiliario_workspace_pending_invites
FOR DELETE
TO authenticated
USING (
  (
    app_slug = public.crm_inmobiliario_app_slug()
    AND workspace_id IN (
      SELECT wm.workspace_id
      FROM public.crm_inmobiliario_workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.role = 'admin'
        AND wm.app_slug = public.crm_inmobiliario_app_slug()
    )
  )
  OR public.current_is_platform_admin()
);

-- ---------------------------------------------------------------------------
-- 7) RPCs administrativas con scope por app
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
    SELECT 1
    FROM public.crm_inmobiliario_workspaces w
    WHERE w.id = p_workspace_id
      AND w.app_slug = public.crm_inmobiliario_app_slug()
  ) THEN
    RAISE EXCEPTION 'workspace does not belong to crm-inmobiliario';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.crm_inmobiliario_profiles p
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

-- ---------------------------------------------------------------------------
-- 8) Grants de funciones clave
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.crm_inmobiliario_app_slug() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_workspace_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_workspace() TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_inmobiliario_admin_list_workspaces() TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_inmobiliario_admin_list_users_without_workspace() TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_inmobiliario_admin_create_workspace(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_inmobiliario_admin_add_member(uuid, uuid, text) TO authenticated;

COMMIT;
