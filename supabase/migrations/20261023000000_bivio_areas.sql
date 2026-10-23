-- Bivio: qué partes del servicio puede usar cada cuenta ("Para profesionales" y "Para empresas").
-- Las cuentas que ya existen quedan con las dos habilitadas (como hasta ahora); quien administra las apaga o
-- prende una por una desde el panel. Solo el servidor cambia estos valores (service role).
-- Se corre una vez, pegado en el SQL Editor del dashboard de Supabase (después de 20261020010000).

alter table public.bivio_perfiles
  add column if not exists acceso_profesionales boolean not null default true,
  add column if not exists acceso_empresas boolean not null default true;

-- El registro de actividad suma la acción "areas". Si la tabla todavía no existe, no se toca.
do $$
begin
  if to_regclass('public.bivio_auditoria') is not null then
    alter table public.bivio_auditoria drop constraint if exists bivio_auditoria_action_check;
    alter table public.bivio_auditoria
      add constraint bivio_auditoria_action_check
      check (action in ('alta', 'activar', 'desactivar', 'pendiente', 'eliminar', 'areas'));
  end if;
end $$;
