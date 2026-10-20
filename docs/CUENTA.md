# Cuenta opcional: guardar el informe y los compromisos

La persona puede guardar **solo su informe y sus compromisos** (nunca la conversación) con su email, verlos
desde otro dispositivo y pedir un recordatorio de check-in. Sin cuenta, todo sigue en el navegador.

## Cómo funciona

- **Entrar:** enlace por email (Supabase Auth, sin contraseña). Al volver del mail se guarda solo lo que la persona
  había elegido y se recuperan en el navegador los informes de su cuenta (`src/lib/cloud.ts`, `App.tsx`).
- **Guardar:** el navegador escribe en `bivio_informes` / `bivio_recordatorios` con su propia sesión. La seguridad la
  da RLS (`supabase/migrations/…`): cada persona ve y toca solo lo suyo.
- **Recordatorio:** un cron de Vercel (`vercel.json`, todos los días 12:00 UTC) llama a `/api/reminders`, que manda
  por Resend los recordatorios vencidos, una sola vez (`server/reminders.ts`).
- **Borrar cuenta:** `/api/account` borra al usuario con la service role; los informes y recordatorios se van en cascada.

## Puesta en marcha (una vez)

1. **Tablas:** pegar `supabase/migrations/20261020000000_bivio_cuenta.sql` en el SQL Editor del dashboard y correrlo.
2. **URLs de acceso:** Authentication → URL Configuration: *Site URL* = la de producción; en *Redirect URLs* sumar
   `http://localhost:5173` y la de producción (y la de los previews de Vercel si se usan).
3. **Variables:** `SUPABASE_URL` (la de la API, no la del dashboard), `SUPABASE_ANON_KEY` y
   `SUPABASE_SERVICE_ROLE_KEY` en `.env` y en Vercel (Production y Preview). La service role es secreta.
4. **Recordatorios (opcional):** cuenta en Resend con un dominio verificado, y en Vercel `RESEND_API_KEY`,
   `REMINDER_FROM`, `APP_URL` y `CRON_SECRET`. Sin ellas el recordatorio simplemente no se manda.
5. **Redeploy** para que el build tome las variables (la URL y la clave anónima se empaquetan en el cliente).

## Límites conocidos

- Cualquiera puede crear una cuenta con su email: el código de acceso de las pruebas privadas no gobierna esto.
  Para limitarlo, desactivar los registros nuevos en Supabase (Authentication → Providers → Email) o validar el código
  antes de enviar el enlace.
- El plan gratuito de Supabase limita los mails de acceso por hora. Para más volumen, configurar un SMTP propio.
- La política de privacidad tiene puntos entre corchetes para el equipo legal (región, retención, transferencias).
- La versión Jaspr (`web_jaspr/`) todavía no tiene la cuenta.
