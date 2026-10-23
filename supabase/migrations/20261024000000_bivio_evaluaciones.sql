-- Bivio: evaluaciones de desempeño.
--   Una evaluación la crea alguien con "Para empresas" (o la persona misma, para evaluarse) y se asigna a cuentas
--   de Bivio. Quien la recibe se autoevalúa y se genera un informe que ve esa persona y quien la creó.
-- Los datos son de personas (respuestas sobre su desempeño): solo el servidor los lee y escribe (service role),
-- aplicando las reglas de quién ve qué. Sin políticas a propósito: el navegador no accede a estas tablas.
-- Se corre una vez, pegado en el SQL Editor del dashboard de Supabase.

create table if not exists public.bivio_evaluaciones (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  -- 'asignada': la crea quien evalúa y la responde otra persona. 'directa': la persona se la arma a sí misma.
  tipo text not null check (tipo in ('asignada', 'directa')),
  titulo text not null,
  area text not null,
  rol text not null default '',
  periodo text not null default '',
  -- [{ id, nombre, descripcion, preguntas: [texto] }]
  competencias jsonb not null,
  lang text not null default 'es' check (lang in ('es', 'en')),
  created_at timestamptz not null default now()
);

create table if not exists public.bivio_asignaciones (
  id uuid primary key default gen_random_uuid(),
  evaluacion_id uuid not null references public.bivio_evaluaciones (id) on delete cascade,
  -- Quien responde. Si su cuenta se borra, se borra su respuesta (derecho de supresión).
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'en_curso', 'completada')),
  -- { [competenciaId]: { nivel: 1..4, evidencia: texto }, desarrollo: texto }
  respuestas jsonb not null default '{}'::jsonb,
  informe jsonb,
  asignada_at timestamptz not null default now(),
  completada_at timestamptz,
  unique (evaluacion_id, user_id)
);

create index if not exists bivio_asignaciones_user on public.bivio_asignaciones (user_id, estado);
create index if not exists bivio_evaluaciones_owner on public.bivio_evaluaciones (owner_id, created_at desc);

alter table public.bivio_evaluaciones enable row level security;
alter table public.bivio_asignaciones enable row level security;
-- Sin políticas: solo la service role (servidor) toca estas tablas.
