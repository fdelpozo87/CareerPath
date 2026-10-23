-- Bivio: el puntaje de quien evalúa. Cuando la persona envía su autoevaluación, quien creó la evaluación puntúa cada
-- competencia de 1 (muy malo) a 5 (muy bueno), con un comentario opcional. Lo decide una persona, nunca el modelo.
-- La persona evaluada ve el puntaje apenas se guarda. Solo el servidor lee y escribe estas tablas.
-- Se corre una vez, pegado en el SQL Editor del dashboard de Supabase (después de 20261024000000).

alter table public.bivio_asignaciones
  -- { [competenciaId]: { puntaje: 1..5, comentario: texto } }
  add column if not exists puntajes jsonb,
  add column if not exists puntuada_at timestamptz;
