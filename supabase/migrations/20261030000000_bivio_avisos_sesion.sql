-- Bivio: aviso por mail a quien dejó una sesión a medias (OPCIONAL: solo si la persona lo activa, y solo con la
-- sincronización de sesiones encendida). Se manda como mucho un aviso por cada vez que la sesión se frena.
-- Se corre una vez, pegado en el SQL Editor del dashboard de Supabase.

alter table public.bivio_sesiones add column if not exists avisar boolean not null default false;
-- Cuándo se mandó el aviso de esta sesión. Cada vez que la sesión se vuelve a guardar se limpia: así, si la retoma y la
-- vuelve a dejar, puede haber otro aviso (siempre pasados los días de inactividad).
alter table public.bivio_sesiones add column if not exists nudged_at timestamptz;

create index if not exists bivio_sesiones_avisos on public.bivio_sesiones (session_updated_at) where avisar and nudged_at is null;
