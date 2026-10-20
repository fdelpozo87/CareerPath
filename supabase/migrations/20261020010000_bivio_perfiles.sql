-- Bivio: quién puede usar el servicio. Cada cuenta nueva queda "pendiente" hasta que la apruebe
-- quien administra desde el panel. Solo las cuentas "activas" usan el coach.
-- Se corre una vez, pegado en el SQL Editor del dashboard de Supabase (después de 20261020000000).

create table if not exists public.bivio_perfiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'activo', 'desactivado')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

alter table public.bivio_perfiles enable row level security;

-- Cada persona puede ver su propio estado. Nadie cambia estados desde el navegador: eso lo hace el
-- servidor con la service role cuando el administrador lo pide.
drop policy if exists "perfiles: ver lo propio" on public.bivio_perfiles;
create policy "perfiles: ver lo propio" on public.bivio_perfiles
  for select to authenticated
  using (auth.uid() = user_id);

-- Al crearse una cuenta se le crea su perfil, pendiente.
create or replace function public.bivio_nuevo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.bivio_perfiles (user_id, email) values (new.id, coalesce(new.email, ''))
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists bivio_on_auth_user_created on auth.users;
create trigger bivio_on_auth_user_created after insert on auth.users
  for each row execute function public.bivio_nuevo_usuario();

-- Las cuentas que ya existían quedan pendientes.
insert into public.bivio_perfiles (user_id, email)
select id, coalesce(email, '') from auth.users
on conflict (user_id) do nothing;

-- Guardar informes y recordatorios también exige una cuenta activa (además del acceso al coach).
create or replace function public.bivio_activo() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.bivio_perfiles where user_id = auth.uid() and estado = 'activo');
$$;

drop policy if exists "informes: lo propio" on public.bivio_informes;
create policy "informes: lo propio" on public.bivio_informes
  for all to authenticated
  using (auth.uid() = user_id and public.bivio_activo())
  with check (auth.uid() = user_id and public.bivio_activo());

drop policy if exists "recordatorios: lo propio" on public.bivio_recordatorios;
create policy "recordatorios: lo propio" on public.bivio_recordatorios
  for all to authenticated
  using (auth.uid() = user_id and public.bivio_activo())
  with check (auth.uid() = user_id and public.bivio_activo());
