-- Bivio: las 4 migraciones nuevas juntas, para pegar de una vez en el SQL Editor de Supabase.
-- Se pueden correr más de una vez sin problema.

-- ════════ 20261027000000_bivio_sesiones ════════
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

-- ════════ 20261028000000_bivio_avisos ════════
-- Bivio: aviso a quien administra cuando entra una cuenta nueva pendiente (se manda una sola vez por cuenta).
-- Se corre una vez, pegado en el SQL Editor del dashboard de Supabase. Si falta, la app sigue funcionando: simplemente
-- no manda el aviso.

alter table public.bivio_perfiles add column if not exists avisado_admin_at timestamptz;

-- Las cuentas que ya están pendientes no avisan retroactivamente: se las marca como avisadas.
update public.bivio_perfiles set avisado_admin_at = now() where estado = 'pendiente' and avisado_admin_at is null;

-- ════════ 20261029000000_bivio_comentarios ════════
-- Bivio: comentarios de las personas dentro de la app (un problema, una idea, otro). Los ve quien administra en el panel.
-- Solo el servidor (service role) lee y escribe: la tabla tiene RLS activada y ninguna política para el navegador.
-- Se corre una vez, pegado en el SQL Editor del dashboard de Supabase.

create table if not exists public.bivio_comentarios (
  id uuid primary key default gen_random_uuid(),
  -- Si la cuenta se borra, el comentario queda (sin vínculo a la persona): sirve igual para mejorar el producto.
  user_id uuid references auth.users (id) on delete set null,
  email text not null,
  tipo text not null check (tipo in ('problema', 'idea', 'otro')),
  mensaje text not null check (char_length(mensaje) between 5 and 2000),
  -- Pantalla desde la que escribió (por ejemplo, #evaluaciones); ayuda a entender el contexto.
  pagina text check (pagina is null or char_length(pagina) <= 120),
  lang text not null default 'es' check (lang in ('es', 'en')),
  leido boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists bivio_comentarios_recientes on public.bivio_comentarios (created_at desc);

alter table public.bivio_comentarios enable row level security;

-- ════════ 20261030000000_bivio_avisos_sesion ════════
-- Bivio: aviso por mail a quien dejó una sesión a medias (OPCIONAL: solo si la persona lo activa, y solo con la
-- sincronización de sesiones encendida). Se manda como mucho un aviso por cada vez que la sesión se frena.
-- Se corre una vez, pegado en el SQL Editor del dashboard de Supabase.

alter table public.bivio_sesiones add column if not exists avisar boolean not null default false;
-- Cuándo se mandó el aviso de esta sesión. Cada vez que la sesión se vuelve a guardar se limpia: así, si la retoma y la
-- vuelve a dejar, puede haber otro aviso (siempre pasados los días de inactividad).
alter table public.bivio_sesiones add column if not exists nudged_at timestamptz;

create index if not exists bivio_sesiones_avisos on public.bivio_sesiones (session_updated_at) where avisar and nudged_at is null;

