-- Bivio: límites de uso compartidos entre todas las instancias del servidor.
-- Los topes en memoria (cada instancia de Vercel tiene la suya) se reinician y no se suman entre instancias;
-- este contador vive en la base y lo usa el servidor con la service role. Ventana fija por clave.
-- Se corre una vez, pegado en el SQL Editor del dashboard de Supabase.

create table if not exists public.bivio_limites (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);

alter table public.bivio_limites enable row level security;
-- Sin políticas a propósito: solo la service role (servidor) toca esta tabla.

create or replace function public.bivio_limite(p_key text, p_window_ms bigint, p_limit integer)
returns table (ok boolean, hits integer, retry_after_s integer)
language plpgsql security definer set search_path = public as $$
declare
  w timestamptz := to_timestamp((floor(extract(epoch from now()) * 1000 / p_window_ms) * p_window_ms) / 1000.0);
  c integer;
begin
  insert into public.bivio_limites as l (key, window_start, hits) values (p_key, w, 1)
  on conflict (key, window_start) do update set hits = l.hits + 1
  returning l.hits into c;

  -- Limpieza ocasional de ventanas viejas (1 de cada 100 llamadas).
  if random() < 0.01 then
    delete from public.bivio_limites where window_start < now() - interval '2 days';
  end if;

  ok := c <= p_limit;
  hits := c;
  retry_after_s := greatest(1, ceil(extract(epoch from (w + (p_window_ms || ' milliseconds')::interval - now())))::integer);
  return next;
end $$;

-- Nadie fuera del servidor puede llamarla.
revoke all on function public.bivio_limite(text, bigint, integer) from public, anon, authenticated;
grant execute on function public.bivio_limite(text, bigint, integer) to service_role;
