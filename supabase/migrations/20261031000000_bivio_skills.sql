-- Bivio: catálogo de skills (soft y hard) disponibles para las evaluaciones.
-- Un skill puede ser global (empresa_id IS NULL, creado por el admin) o propio de una empresa.
-- Se corre una vez, pegado en el SQL Editor del dashboard de Supabase.

create table if not exists public.bivio_skills (
  id          uuid        default gen_random_uuid() primary key,
  nombre      text        not null check (char_length(nombre) between 1 and 120),
  tipo        text        not null check (tipo in ('soft', 'hard')),
  descripcion text        not null default '',
  empresa_id  uuid        references auth.users(id) on delete cascade,
  created_at  timestamptz default now() not null,
  created_by  uuid        references auth.users(id) on delete set null
);

-- El admin puede leer y escribir todo; las empresas leen los globales y los suyos.
alter table public.bivio_skills enable row level security;

-- Service role (server) puede hacer todo sin RLS.
create policy "service role bypass" on public.bivio_skills
  as permissive for all
  to service_role
  using (true)
  with check (true);

create index if not exists bivio_skills_tipo on public.bivio_skills (tipo);
create index if not exists bivio_skills_empresa on public.bivio_skills (empresa_id) where empresa_id is not null;
