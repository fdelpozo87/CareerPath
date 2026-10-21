-- Bivio: registro de lo que hace quien administra (alta, activar, desactivar, eliminar).
-- Solo lo escribe y lo lee el servidor con la service role: sin políticas, nadie más puede tocarlo.
-- Se corre una vez, pegado en el SQL Editor del dashboard de Supabase.

create table if not exists public.bivio_auditoria (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_email text not null,
  action text not null check (action in ('alta', 'activar', 'desactivar', 'pendiente', 'eliminar')),
  target_email text not null,
  detail jsonb
);

create index if not exists bivio_auditoria_at on public.bivio_auditoria (at desc);

alter table public.bivio_auditoria enable row level security;
-- Sin políticas a propósito: ni el navegador ni cuentas comunes pueden leerla ni modificarla.
