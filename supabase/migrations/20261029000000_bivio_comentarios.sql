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
