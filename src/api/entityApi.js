import { supabase } from '@/api/supabaseClient';

/** Nombres de tablas en Supabase (prefijo crm_inmobiliario_) */
export const TBL = {
  profiles: 'crm_inmobiliario_profiles',
  workspaces: 'crm_inmobiliario_workspaces',
  workspace_members: 'crm_inmobiliario_workspace_members',
  workspace_pending_invites: 'crm_inmobiliario_workspace_pending_invites',
  workspace_settings: 'crm_inmobiliario_workspace_settings',
  pipeline_stages: 'crm_inmobiliario_pipeline_stages',
  tags: 'crm_inmobiliario_tags',
  custom_fields: 'crm_inmobiliario_custom_fields',
  listas_whatsapp: 'crm_inmobiliario_listas_whatsapp',
  plantillas_whatsapp: 'crm_inmobiliario_plantillas_whatsapp',
  variable_plantilla: 'crm_inmobiliario_variable_plantilla',
  consultas: 'crm_inmobiliario_consultas',
  contactos: 'crm_inmobiliario_contactos',
  ventas: 'crm_inmobiliario_ventas',
  properties: 'crm_inmobiliario_properties',
  proveedores: 'crm_inmobiliario_proveedores',
  envios_whatsapp: 'crm_inmobiliario_envios_whatsapp',
  mensajes: 'crm_inmobiliario_mensajes',
};

const META_KEYS = new Set([
  'id',
  'workspace_id',
  'created_at',
  'updated_at',
  'created_date',
  'updated_date',
  'doc',
  'fecha',
  'codigo',
  'postventa_activa',
  'proximo_seguimiento_postventa',
]);

function toDocPayload(obj) {
  const doc = {};
  if (!obj || typeof obj !== 'object') return doc;
  for (const [k, v] of Object.entries(obj)) {
    if (!META_KEYS.has(k) && v !== undefined) doc[k] = v;
  }
  return doc;
}

export function fromDocRow(row) {
  if (!row) return null;
  const { doc, created_at, updated_at, id, workspace_id } = row;
  const d = doc && typeof doc === 'object' ? doc : {};
  return {
    ...d,
    id,
    workspace_id,
    created_date: created_at,
    updated_date: updated_at,
  };
}

function fromFlatRow(row) {
  if (!row) return null;
  return {
    ...row,
    created_date: row.created_at,
    updated_date: row.updated_at,
  };
}

function isVentaMongoQuery(filters) {
  return (
    filters &&
    typeof filters === 'object' &&
    filters.fecha &&
    typeof filters.fecha === 'object' &&
    ('$gte' in filters.fecha || '$lte' in filters.fecha)
  );
}

function ventasMatchMongo(v, filters) {
  if (filters.fecha?.$gte && v.fecha && v.fecha < filters.fecha.$gte) return false;
  if (filters.fecha?.$lte && v.fecha && v.fecha > filters.fecha.$lte) return false;
  if (filters.marketplace && v.marketplace !== filters.marketplace) return false;
  if (filters.estado && v.estado !== filters.estado) return false;
  if (filters.porUsuarioId && v.porUsuarioId !== filters.porUsuarioId) return false;
  if (filters.proveedorTexto && v.proveedorTexto !== filters.proveedorTexto) return false;
  return true;
}

function applyOrder(q, table, orderSpec) {
  if (!orderSpec) return q.order('created_at', { ascending: false });
  const desc = orderSpec.startsWith('-');
  const raw = desc ? orderSpec.slice(1) : orderSpec;
  const map = {
    created_date: 'created_at',
    updated_date: 'updated_at',
    orden: 'orden',
    fecha: table === TBL.ventas ? 'fecha' : 'created_at',
    codigo: 'codigo',
    proximoSeguimientoPostventa: 'proximo_seguimiento_postventa',
  };
  const col = map[raw] || (raw === 'fecha' ? 'created_at' : raw);
  const ascending = !desc;
  if (col === 'proximo_seguimiento_postventa' || col === 'fecha') {
    return q.order(col, { ascending, nullsFirst: false });
  }
  return q.order(col, { ascending });
}

function applyDocFilters(q, filters, options = {}) {
  const { table } = options;
  if (!filters || typeof filters !== 'object') return q;
  const copy = { ...filters };
  if (copy.workspace_id) {
    q = q.eq('workspace_id', copy.workspace_id);
    delete copy.workspace_id;
  }
  if (copy.id) {
    q = q.eq('id', copy.id);
    delete copy.id;
  }
  if (table === TBL.ventas && 'postventaActiva' in copy) {
    q = q.eq('postventa_activa', !!copy.postventaActiva);
    delete copy.postventaActiva;
  }
  for (const [k, v] of Object.entries(copy)) {
    if (v === undefined) continue;
    q = q.contains('doc', { [k]: v });
  }
  return q;
}

function makeDocEntity(table, { workspaceOptional = false } = {}) {
  return {
    async filter(filters = {}, order, limit = 2000) {
      let q = supabase.from(table).select('*');
      q = applyDocFilters(q, filters, { table });
      q = applyOrder(q, table, order);
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map(fromDocRow);
    },
    async list(order, limit = 500, _extra) {
      return this.filter({}, order, limit);
    },
    async create(payload) {
      const ws = payload.workspace_id;
      if (!ws && !workspaceOptional) throw new Error('workspace_id requerido');
      const row = {
        workspace_id: ws || null,
        doc: toDocPayload(payload),
      };
      const { data, error } = await supabase.from(table).insert(row).select('*').single();
      if (error) throw error;
      return fromDocRow(data);
    },
    async update(id, patch) {
      const { data: existing, error: e1 } = await supabase.from(table).select('doc').eq('id', id).single();
      if (e1) throw e1;
      const nextDoc = { ...(existing?.doc || {}), ...toDocPayload(patch) };
      const { data, error } = await supabase
        .from(table)
        .update({ doc: nextDoc })
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return fromDocRow(data);
    },
    async delete(id) {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
    },
  };
}

function makeFlatEntity(table) {
  return {
    async filter(filters = {}, order, limit = 2000) {
      let q = supabase.from(table).select('*');
      for (const [k, v] of Object.entries(filters)) {
        if (v === undefined) continue;
        q = q.eq(k, v);
      }
      q = applyOrder(q, table, order);
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map(fromFlatRow);
    },
    async list(order, limit = 500) {
      return this.filter({}, order, limit);
    },
    async create(payload) {
      const { data, error } = await supabase.from(table).insert(payload).select('*').single();
      if (error) throw error;
      return fromFlatRow(data);
    },
    async update(id, patch) {
      const { data, error } = await supabase.from(table).update(patch).eq('id', id).select('*').single();
      if (error) throw error;
      return fromFlatRow(data);
    },
    async delete(id) {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
    },
  };
}

const ventasDocEntity = makeDocEntity(TBL.ventas);

const ventaApi = {
  async filter(filters = {}, order, limit = 2000) {
    if (isVentaMongoQuery(filters)) {
      let q = supabase.from(TBL.ventas).select('*');
      q = applyOrder(q, TBL.ventas, order || '-fecha');
      q = q.limit(Math.min(limit || 5000, 10000));
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map(fromDocRow).filter((v) => ventasMatchMongo(v, filters));
    }
    let q = supabase.from(TBL.ventas).select('*');
    q = applyDocFilters(q, filters, { table: TBL.ventas });
    q = applyOrder(q, TBL.ventas, order);
    if (limit) q = q.limit(limit);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map(fromDocRow);
  },
  async list(order, limit = 500, _extra) {
    return this.filter({}, order, limit);
  },
  async create(payload) {
    return ventasDocEntity.create(payload);
  },
  async update(id, patch) {
    return ventasDocEntity.update(id, patch);
  },
  async delete(id) {
    return ventasDocEntity.delete(id);
  },
  async bulkCreate(rows) {
    if (!rows?.length) return;
    const batch = rows.map((r) => ({
      workspace_id: r.workspace_id,
      doc: toDocPayload(r),
    }));
    const chunk = 200;
    for (let i = 0; i < batch.length; i += chunk) {
      const { error } = await supabase.from(TBL.ventas).insert(batch.slice(i, i + chunk));
      if (error) throw error;
    }
  },
};

async function listWorkspaceUserProfiles() {
  const { data: members, error } = await supabase.from(TBL.workspace_members).select('user_id');
  if (error) throw error;
  const ids = [...new Set((members || []).map((m) => m.user_id))];
  if (!ids.length) return [];
  const { data: profiles, error: e2 } = await supabase.from(TBL.profiles).select('*').in('id', ids);
  if (e2) throw e2;
  return (profiles || []).map((p) => ({
    id: p.id,
    email: p.email,
    full_name: p.full_name,
    consulta_follow_up_days: p.consulta_follow_up_days,
    postventa_follow_up_days: p.postventa_follow_up_days,
    created_date: p.created_at,
    updated_date: p.updated_at,
  }));
}

const workspaceMemberBase = makeFlatEntity(TBL.workspace_members);

export const entities = {
  Consulta: makeDocEntity(TBL.consultas),
  Contacto: makeDocEntity(TBL.contactos),
  Venta: ventaApi,
  Property: makeDocEntity(TBL.properties),
  Proveedor: makeDocEntity(TBL.proveedores),
  PipelineStage: makeFlatEntity(TBL.pipeline_stages),
  Tag: makeFlatEntity(TBL.tags),
  CustomField: makeFlatEntity(TBL.custom_fields),
  ListaWhatsApp: makeDocEntity(TBL.listas_whatsapp),
  PlantillaWhatsApp: makeDocEntity(TBL.plantillas_whatsapp),
  VariablePlantilla: makeDocEntity(TBL.variable_plantilla),
  EnvioWhatsApp: makeDocEntity(TBL.envios_whatsapp, { workspaceOptional: true }),
  Mensaje: makeDocEntity(TBL.mensajes),
  Workspace: makeFlatEntity(TBL.workspaces),
  WorkspaceMember: {
    ...workspaceMemberBase,
    async filter(filters = {}, order, limit = 2000) {
      const rows = await workspaceMemberBase.filter(filters, order, limit);
      const ids = [...new Set(rows.map((r) => r.user_id))];
      if (!ids.length) return rows;
      const { data: profs, error } = await supabase.from(TBL.profiles).select('id,full_name,email').in('id', ids);
      if (error) throw error;
      const pm = Object.fromEntries((profs || []).map((p) => [p.id, p]));
      return rows.map((r) => ({
        ...r,
        email: pm[r.user_id]?.email,
        full_name: pm[r.user_id]?.full_name,
      }));
    },
  },
  WorkspaceSettings: makeFlatEntity(TBL.workspace_settings),
  User: {
    list: listWorkspaceUserProfiles,
  },
};
