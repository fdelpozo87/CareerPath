# Operación de Bivio

Lo que hay que tener armado para que el servicio se sostenga solo: monitoreo, copias de seguridad, entornos, plan B del modelo,
pruebas automáticas y qué hacer cuando algo falla. Lo que depende de cuentas externas (Supabase, Vercel, GitHub, Resend,
Sentry) se configura a mano; lo demás ya está en el repositorio.

## Monitoreo

- **Estado del servicio:** `GET https://<tu-dominio>/api/health`. Responde `200` con `{ ok: true, checks: { supabase, gemini, email } }`
  y `503` si Supabase está configurado y no responde. No muestra secretos ni llama al modelo (costaría). Guarda el resultado 20 s.
- **Aviso de caída (5 minutos):** crear un monitor HTTP en UptimeRobot o Better Stack apuntando a esa dirección, con alerta por
  email a quien administra. Es gratis y lo más rentable que hay para enterarse antes que los usuarios.
- **Errores del navegador:** Sentry se activa con `VITE_SENTRY_DSN` en Vercel (el DSN es público). Nunca envía conversaciones ni
  documentos (ver `src/lib/monitoring.ts`). Sin esa variable no hay registro de errores del cliente: conviene cargarla.
- **Errores del servidor:** quedan en los logs de Vercel (*Project → Logs*), con eventos con nombre (`gemini_retry`,
  `gemini_fallback`, `aviso_cuenta_nueva`, `avisos_sesion`, `comentario`, `auditoria_no_registrada`…). Filtrar por el nombre.
- **Uso y velocidad:** Vercel Analytics y Speed Insights ya están integrados.

## Copias de seguridad

Supabase en el plan gratuito **no** ofrece copias que se puedan restaurar. Hasta pasar a un plan con copias diarias o
recuperación a un punto en el tiempo, hay un respaldo propio:

- **Cada lunes** el workflow `.github/workflows/backup.yml` baja las tablas (`scripts/backup.mjs`), las comprime, las cifra con
  AES-256 y las guarda como artefacto 30 días. También se puede correr a mano (*Actions → Copia de seguridad → Run workflow*).
- **Secretos a cargar** en GitHub (*Settings → Secrets and variables → Actions*): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y
  `BACKUP_PASSPHRASE` (una frase larga que solo vos guardás, por ejemplo en tu gestor de contraseñas; sin ella no se descifra).
- **Descifrar:** `openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in backup.tar.gz.enc -out backup.tar.gz` y `tar -xzf backup.tar.gz`.
- **A mano:** `npm run backup` deja los JSON en `backups/AAAA-MM-DD/` (no se commitean: tienen datos personales).
- **Qué no incluye:** contraseñas y factores de verificación en dos pasos (viven en `auth.users`). Tras una restauración, cada
  persona usa "Olvidé mi contraseña".
- **Restaurar:** en un proyecto de Supabase con las migraciones corridas, insertar los JSON tabla por tabla (SQL Editor o la
  API REST), en este orden por las claves foráneas: `bivio_perfiles`, `bivio_informes`, `bivio_recordatorios`,
  `bivio_evaluaciones`, `bivio_asignaciones`, `bivio_compartidas`, `bivio_sesiones`, `bivio_comentarios`, `bivio_auditoria`.
  Probar una restauración en un proyecto de prueba al menos una vez: una copia que nunca se restauró no es una copia.

## Entornos

- **Producción:** rama `main` en Vercel, con su proyecto de Supabase.
- **Previews:** cada PR genera una URL de Vercel. Hoy comparten las variables de producción, o sea la misma base: una prueba en un
  preview toca datos reales. Recomendado: crear un **segundo proyecto de Supabase** ("bivio-staging"), correr las migraciones
  y cargar sus variables solo en el entorno *Preview* de Vercel (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
  Así se prueban registros, aprobaciones y evaluaciones sin riesgo.
- **Local:** `npm run dev`; sin Supabase configurado funciona en modo de prueba.

## Plan B del modelo

- `GEMINI_MODEL`: modelo principal (por defecto `gemini-3.5-flash-lite`).
- `GEMINI_FALLBACK_MODEL` (opcional): si el principal falla por sobrecarga o timeout (429, 5xx), la misma llamada se repite con este
  modelo (log `gemini_fallback`). Los errores de pedido inválido o bloqueo de seguridad no se reintentan. La búsqueda de datos de
  mercado no usa respaldo (depende de la búsqueda de Google del modelo principal).
- Antes de poner un respaldo conviene correr la evaluación del coach con él (`GEMINI_MODEL=<respaldo> npm run eval`).

## Pruebas automáticas

| Qué | Cómo | Cuándo |
|---|---|---|
| Unitarias y de servidor (243) | `npm test` | cada PR |
| Punta a punta en Chrome | `npm run e2e` (compila con Supabase simulado y recorre ingreso, registro, recuperación, idioma y una conversación) | cada PR (job `e2e` de `ci.yml`) |
| Calidad del coach con Gemini real | `npm run eval`, o el workflow *Evaluación del coach* | cada lunes y a pedido; necesita el secreto `GEMINI_API_KEY` |

Las pruebas de punta a punta no gastan modelo ni tocan datos: Supabase y `/api` se simulan en el navegador (`e2e/helpers.ts`).

## Variables de entorno (resumen)

| Variable | Para qué | Obligatoria |
|---|---|---|
| `GEMINI_API_KEY` | el coach y las evaluaciones | sí |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | cuentas y datos | sí (modo cuentas) |
| `ADMIN_EMAIL` | quién administra (uno o varios, separados por coma) | sí |
| `RESEND_API_KEY`, `REMINDER_FROM`, `APP_URL` | mails con la marca, avisos y recordatorios | recomendada |
| `CRON_SECRET` | protege el envío de recordatorios | si hay recordatorios |
| `VITE_SENTRY_DSN` | errores del navegador | recomendada |
| `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL` | modelo principal y plan B | opcionales |
| `ADMIN_REQUIRE_MFA` | `0` desactiva el segundo paso del panel (no recomendado) | opcional |

## Migraciones, en orden

`supabase/migrations/`: cuenta, perfiles, auditoría, límites, áreas, evaluaciones, puntajes, compartidas, **sesiones**, **avisos**,
**comentarios**, **avisos de sesión**. Se pegan una vez en el SQL Editor y se pueden volver a correr.

## Si algo falla

1. **La gente no puede entrar:** abrir `/api/health`. Si `supabase` está en `error`, mirar el estado de Supabase y la cuota del
   proyecto; si está bien, revisar los logs de Vercel por `auditoria_no_registrada` o errores de `/api/access`.
2. **El coach no responde o es lento:** logs con `gemini_retry` o `gemini_fallback`. Si hay muchos, el modelo está sobrecargado:
   configurar `GEMINI_FALLBACK_MODEL` o subir de plan en Google AI.
3. **No llegan mails:** `/api/health` → `email`. Si dice `falta`, cargar `RESEND_API_KEY` y `REMINDER_FROM`. Si está configurado,
   revisar el dominio verificado y los envíos en el panel de Resend.
4. **Se rompió un dato:** restaurar desde la última copia (sección anterior) en un proyecto de prueba primero.
5. **Se filtró una clave:** rotarla en el proveedor (Supabase, Google, Resend), actualizarla en Vercel y GitHub y redesplegar.

## Antes de cada lanzamiento

`npm run lint`, `npm test`, `npm run e2e` y `npm run build` en verde; migraciones nuevas corridas en Supabase; variables nuevas
cargadas en Vercel; y revisar el preview de Vercel con una cuenta real.
