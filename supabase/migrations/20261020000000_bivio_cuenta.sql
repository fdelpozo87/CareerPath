-- Bivio: guardar el informe y los compromisos en la cuenta de la persona (opcional) y recordarle el check-in.
-- Solo se guarda el informe y los compromisos, nunca la conversación.
-- Se corre una vez, pegado en el SQL Editor del dashboard de Supabase.
-- Las tablas llevan el prefijo bivio_ porque comparten el esquema public con otros productos.

create table if not exists public.bivio_informes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Id del proceso en el navegador: permite volver a guardar sin duplicar y recuperar el proceso en otro dispositivo.
  process_id text not null,
  path text not null check (path in ('quiebre', 'perfil', 'formacion')),
  informe jsonb not null,
  -- Índices de informe.acciones que la persona asumió.
  compromisos jsonb not null default '[]'::jsonb,
  compromisos_fecha timestamptz,
  lang text not null default 'es' check (lang in ('es', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, process_id)
);

create table if not exists public.bivio_recordatorios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  informe_id uuid not null unique references public.bivio_informes (id) on delete cascade,
  due_at timestamptz not null,
  lang text not null default 'es' check (lang in ('es', 'en')),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists bivio_recordatorios_pendientes on public.bivio_recordatorios (due_at) where sent_at is null;

alter table public.bivio_informes enable row level security;
alter table public.bivio_recordatorios enable row level security;

-- Cada persona ve y modifica solo lo suyo. El envío de recordatorios usa la service role (servidor).
create policy "informes: lo propio" on public.bivio_informes
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "recordatorios: lo propio" on public.bivio_recordatorios
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.bivio_touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists bivio_informes_touch on public.bivio_informes;
create trigger bivio_informes_touch before update on public.bivio_informes
  for each row execute function public.bivio_touch_updated_at();
