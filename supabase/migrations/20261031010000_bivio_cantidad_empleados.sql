-- Bivio: cantidad de empleados declarada por la empresa (o cargada por el admin).
-- Se corre una vez, pegado en el SQL Editor del dashboard de Supabase.

alter table public.bivio_perfiles
  add column if not exists cantidad_empleados integer check (cantidad_empleados is null or cantidad_empleados >= 0);
