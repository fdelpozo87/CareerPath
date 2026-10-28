-- Bivio: aviso a quien administra cuando entra una cuenta nueva pendiente (se manda una sola vez por cuenta).
-- Se corre una vez, pegado en el SQL Editor del dashboard de Supabase. Si falta, la app sigue funcionando: simplemente
-- no manda el aviso.

alter table public.bivio_perfiles add column if not exists avisado_admin_at timestamptz;

-- Las cuentas que ya están pendientes no avisan retroactivamente: se las marca como avisadas.
update public.bivio_perfiles set avisado_admin_at = now() where estado = 'pendiente' and avisado_admin_at is null;
