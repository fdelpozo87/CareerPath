-- Bivio: compartir una autoevaluación propia ("Evaluarme") con otra persona, en modo lectura.
-- La decisión es siempre de quien se evaluó: nada se comparte salvo que ella lo pida, y puede dejar de compartirlo.
-- Solo el servidor lee y escribe esta tabla (service role).
-- Se corre una vez, pegado en el SQL Editor del dashboard de Supabase (después de 20261025000000).

create table if not exists public.bivio_compartidas (
  asignacion_id uuid not null references public.bivio_asignaciones (id) on delete cascade,
  -- Quien puede leerla. Si su cuenta se borra, se borra el acceso.
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  primary key (asignacion_id, user_id)
);

create index if not exists bivio_compartidas_user on public.bivio_compartidas (user_id, created_at desc);

alter table public.bivio_compartidas enable row level security;
-- Sin políticas: el navegador no accede a esta tabla.
