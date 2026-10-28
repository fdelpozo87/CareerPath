-- Bivio: sesiones del coach sincronizadas entre dispositivos (OPCIONAL: solo si la persona lo activa en su cuenta).
-- A diferencia de bivio_informes, acá SÍ se guarda la conversación completa y los documentos que la persona subió.
-- Por eso la opción está apagada por defecto, se explica antes de activarla y se puede apagar borrando todo lo
-- subido. La política de privacidad tiene que decirlo (ver docs/LEGAL_PENDIENTES.md).
-- Se corre una vez, pegado en el SQL Editor del dashboard de Supabase.

create table if not exists public.bivio_sesiones (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Id del proceso en el navegador: permite que el mismo proceso se actualice desde cualquier dispositivo.
  process_id text not null,
  path text not null check (path in ('quiebre', 'perfil', 'formacion')),
  -- La sesión completa tal como la guarda el navegador.
  data jsonb not null check (pg_column_size(data) < 600000),
  lang text not null default 'es' check (lang in ('es', 'en')),
  -- updatedAt de la sesión (reloj del navegador): con él se decide cuál versión es más nueva al mezclar.
  session_updated_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, process_id)
);

alter table public.bivio_sesiones enable row level security;

-- Cada persona ve y modifica solo lo suyo.
drop policy if exists "sesiones: lo propio" on public.bivio_sesiones;
create policy "sesiones: lo propio" on public.bivio_sesiones
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists bivio_sesiones_touch on public.bivio_sesiones;
create trigger bivio_sesiones_touch before update on public.bivio_sesiones
  for each row execute function public.bivio_touch_updated_at();
