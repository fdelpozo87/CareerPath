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

## Pantalla de acceso: Ingresar y Crear cuenta

- **Ingresar:** email y contraseña. Debajo del campo está "Olvidé mi contraseña" (manda un email para elegir otra) y, como
  alternativa, "Prefiero recibir un enlace por email" para quien no tiene o no recuerda la contraseña. Si el email no tiene
  cuenta, el enlace no lo revela (muestra el mismo aviso que cuando se envía).
- **Crear cuenta:** email y contraseña (mínimo 10 caracteres). Supabase manda un mensaje para confirmar el email (plantilla
  "Confirm signup") y la cuenta queda `pendiente`: no puede usar Bivio hasta que quien administra la active desde el panel;
  mientras tanto ve la pantalla "pendiente de aprobación". Si la confirmación de email está desactivada en Supabase, entra
  directo a esa pantalla.
- Requiere que los registros estén **abiertos** en Supabase (*Authentication → Sign In / Providers → Email → Allow new users
  to sign up*). Si están cerrados, "Crear cuenta" avisa que el registro está cerrado en lugar de fingir que funcionó. Si el
  email ya tiene cuenta, lo avisa y sugiere ingresar o recuperar la contraseña.
- Recomendado en Supabase: dejar activada la confirmación de email (*Confirm email*), para que no se registren emails ajenos.

## Sincronizar sesiones entre dispositivos (opcional)

- **Apagada por defecto.** Menú de la cuenta → "Sincronizar mis sesiones". Antes de activarla se explica que se guarda la
  conversación completa y los documentos subidos. La preferencia vive en la cuenta (`user_metadata.sync_sesiones`), no en el
  navegador, así que vale en todos los dispositivos.
- **Qué se guarda:** la sesión entera en `bivio_sesiones` (migración `20261027000000_bivio_sesiones.sql`, con RLS: cada persona
  ve solo lo suyo). Tope de 400 KB por sesión; una más grande queda solo en el navegador.
- **Cómo se mezcla** (`src/lib/sync.ts`): al entrar y al activarla, de cada sesión gana la versión más nueva (`updatedAt`);
  después se sube cada cambio con una pausa de 2 s. Si dos dispositivos editan la misma sesión a la vez, gana la última
  (no se combinan mensajes).
- **Borrados:** borrar una sesión, o "Borrar mis procesos", la borra también de la cuenta. Una sesión ya sincronizada que
  desaparece de la cuenta se borra en los otros dispositivos al entrar. Apagar la opción borra lo guardado en la cuenta y
  conserva lo del navegador. Borrar la cuenta lo borra todo (cascada).
- **Hay que correr la migración** en el SQL Editor antes de usarla; si falta, activarla falla y queda apagada.
- La política de privacidad debe actualizarse (ver `docs/LEGAL_PENDIENTES.md`).

## Avisos de administración y varios administradores

- **Varios administradores:** `ADMIN_EMAIL` admite varios emails separados por coma (`a@x.com, b@x.com`). Todos tienen los mismos
  permisos, así el panel no depende de una sola persona. Cada uno necesita su verificación en dos pasos (salvo `ADMIN_REQUIRE_MFA=0`).
- **Aviso de cuenta nueva:** cuando alguien se registra, confirma su email y entra, quien administra recibe un mail con el
  botón al panel (una sola vez por cuenta). Requiere Resend (`RESEND_API_KEY` y `REMINDER_FROM`) y la migración
  `20261028000000_bivio_avisos.sql`. Sin Resend no se manda nada y el aviso queda pendiente: sale cuando se configura. Sin la
  migración, la app funciona igual pero no avisa.
- **Aviso de activación:** al pasar una cuenta de pendiente a activa desde el panel, la persona recibe un mail (español e
  inglés) que la invita a entrar. Desactivar o reactivar una cuenta no manda nada.

## Límites conocidos

- Cualquiera puede crear una cuenta con su email: el código de acceso de las pruebas privadas no gobierna esto.
  Para limitarlo, desactivar los registros nuevos en Supabase (Authentication → Providers → Email) o validar el código
  antes de enviar el enlace.
- El plan gratuito de Supabase limita los mails de acceso por hora. Para más volumen, configurar un SMTP propio.
- La política de privacidad tiene puntos entre corchetes para el equipo legal (región, retención, transferencias).
- La versión Jaspr (`web_jaspr/`) todavía no tiene la cuenta.

## Acceso por cuenta y panel de usuarios

Con Supabase configurado, **el login con email reemplaza al código de invitación** (`ACCESS_CODES` deja de usarse):

- Cada persona entra con un enlace por email. Una cuenta nueva queda **pendiente**: no puede usar el coach (ni gastar
  cuota de Gemini) hasta que la apruebes.
- Estados: `pendiente`, `activo`, `desactivado`. Solo `activo` usa el coach. El servidor lo verifica en cada pedido
  (`server/auth.ts`); un cambio de estado surte efecto en menos de un minuto.
- **Administra quien tenga el email de `ADMIN_EMAIL`** (confirmado por el enlace). Esa cuenta siempre está activa y ve
  “Administrar usuarios” en el menú de la cuenta (`#admin`). Para el resto de las personas el panel no existe: el
  servidor responde 404 a cualquier pedido que no venga del administrador (`server/admin.ts`).
- Desde el panel: ver quién tiene cuenta (alta y último acceso), activar o desactivar con un interruptor, y eliminar
  (borra la cuenta con sus informes y recordatorios; si se vuelve a registrar, queda pendiente).
- `REQUIRE_LOGIN=0` apaga el acceso por cuenta y vuelve al código (desarrollo local).

### Puesta en marcha

1. Correr `supabase/migrations/20261020010000_bivio_perfiles.sql` en el SQL Editor **antes** de desplegar este código
   (sin la tabla `bivio_perfiles` el servidor no puede verificar cuentas y falla cerrado). Las cuentas que ya existían
   quedan pendientes.
2. Cargar `ADMIN_EMAIL` en `.env` y en Vercel (Production y Preview), junto con las variables de Supabase.
3. Entrar una vez con el email de administrador: queda activo y aparece el panel.
4. Los códigos de `ACCESS_CODES` ya no abren nada mientras haya cuentas; se pueden borrar de Vercel cuando todo funcione.

### Alta de cuentas por quien administra

En el panel, “Agregar una cuenta”: se escribe el email y la cuenta queda **activa** de una vez (sin aprobación); la
persona entra pidiendo su enlace con ese mismo email. Si se tilda “Enviarle ahora el enlace”, el servidor le manda el
mismo mail de acceso (si el envío falla, el alta igual queda hecha). Si el email ya tenía cuenta (pendiente o
desactivada), se la deja activa. El alta usa la API de administración de Supabase con la service role
(`createUser` en `server/cloud.ts`) y no guarda ninguna contraseña.

### Qué parte puede usar cada cuenta (profesionales y empresas)

Cada cuenta tiene dos interruptores, que se cambian desde el panel (y al dar de alta una cuenta se eligen):

- **Para profesionales:** el coach (`/api/coach`) y los tres caminos de la home.
- **Para empresas:** el análisis de Empresas (`/api/analyze`) y su sección.

Por defecto, las dos. El servidor lo exige en cada pedido (`reason: sin_area`, 403) y la pantalla solo muestra las partes
habilitadas (menú, pie, home); si una cuenta activa no tiene ninguna, ve un aviso. Quien administra usa todo siempre.
Volver a dar de alta a alguien que ya tenía cuenta no le devuelve las partes que se le habían quitado. Cada cambio queda
en “Actividad reciente”. Requiere la migración `supabase/migrations/20261023000000_bivio_areas.sql` (sin ella, el
servidor no puede leer los interruptores: correrla **antes** de desplegar).

### Contraseña (opcional)

Además del enlace por email, quien ya tiene cuenta puede elegir una contraseña:

- **Dónde se guarda:** solo en Supabase Auth, con hash (bcrypt). Ni el navegador ni nuestro servidor la almacenan,
  la reciben en un pedido propio ni la registran en logs: el navegador habla directo con Supabase.
- **Crear o cambiar:** menú de la cuenta → “Crear o cambiar contraseña” (mínimo 10 caracteres).
- **Entrar:** en la pantalla de acceso, “Entrar con contraseña”. “Olvidé mi contraseña” manda un email para elegir otra.
- **Registro con contraseña:** cualquiera puede crear una cuenta con email y contraseña desde "Crear cuenta". Las cuentas
  nuevas quedan pendientes hasta que se aprueben, y el estado (`pendiente` / `activo` / `desactivado`) manda igual con
  contraseña que con enlace.
- **Recomendado en Supabase** (Authentication → Providers → Email): subir el largo mínimo de contraseña a 10 o más y,
  si el plan lo permite, activar la protección contra contraseñas filtradas.

### Seguridad del panel

- **Verificación en dos pasos (TOTP):** el servidor solo deja tocar el panel a una sesión que pasó también el código
  de una app autenticadora (nivel `aal2`). La primera vez, el panel muestra un QR para activarla; después pide el
  código de 6 dígitos al entrar. Es obligatoria: `ADMIN_REQUIRE_MFA=0` la apaga solo para desarrollo. Requiere TOTP
  habilitado en Supabase (Authentication → Multi-Factor) y se lee del token ya verificado por Supabase (`server/auth.ts`).
- **Registro de actividad:** cada alta, activación, desactivación y eliminación queda en `bivio_auditoria` (quién, a
  quién, cuándo) y se ve en “Actividad reciente” del panel. Solo el servidor puede escribirla o leerla. Si el registro
  falla, la acción se hace igual y queda un error en los logs.
- Correr `supabase/migrations/20261021000000_bivio_auditoria.sql` antes de desplegar (sin la tabla, las acciones
  funcionan pero no se registran).

### Verificación en dos pasos opcional (cualquier cuenta)

Menú de la cuenta → “Verificación en dos pasos”: cada persona puede activarla (QR + código de una app autenticadora) o
desactivarla. Quien la activó debe pasar el código en cada sesión: el servidor lo exige (`mfa_requerido`) leyendo del
usuario de Supabase si tiene un factor verificado y comprobando que el token sea `aal2` (`server/auth.ts`); si no, la
pantalla muestra “Verifica que eres tú”. Para el administrador sigue siendo obligatoria en el panel.

### Registros cerrados y SMTP propio

- **Registros cerrados:** en Supabase, *Authentication → Sign In / Providers → Email → “Allow new users to sign up”* en
  apagado. Las cuentas las da de alta quien administra desde el panel (la API de administración no depende de ese
  interruptor). El cliente pide el enlace con `shouldCreateUser: false` y, si el email no tiene cuenta, muestra el mismo
  aviso que cuando el enlace se envía, para no revelar quién tiene acceso.
- **SMTP propio:** *Authentication → Emails → SMTP Settings*. Con Resend: host `smtp.resend.com`, puerto `465`, usuario
  `resend`, contraseña = la API key (`re_…`), remitente de un dominio verificado en Resend. Después, en *Authentication →
  Rate Limits*, se puede subir el tope de mails por hora. Los mismos datos de Resend sirven para los recordatorios
  (`RESEND_API_KEY`, `REMINDER_FROM`).
- Con los registros cerrados el estado `pendiente` casi no se usa (solo cuentas que ya existían): se mantiene como red de
  seguridad.

### Límites

- La versión Jaspr (`web_jaspr/`) sigue con el acceso por código y no funciona con el acceso por cuenta.
- Cualquiera puede registrarse; sin aprobación no usa el servicio, pero sí crea una cuenta pendiente. Si molesta,
  desactivar los registros nuevos en Supabase (Authentication → Providers → Email) y crear las cuentas a mano.

## Emails con el diseño de Bivio

- **Altas desde el panel de administración:** si `RESEND_API_KEY` y `REMINDER_FROM` están configuradas, el aviso sale por Resend con el
  diseño de Bivio (el enlace se genera con `generate_link` de Supabase). Si no, o si el envío falla, sale el mail estándar de Supabase.
- **Mails de Supabase (enlace de ingreso, recuperar contraseña, etc.):** las plantillas ya diseñadas están en `supabase/email-templates/`
  (generadas con `node scripts/gen-email-templates.mjs`). Se pegan una vez en Supabase → Authentication → Emails → Templates; el
  README de esa carpeta trae el asunto de cada una. Requiere el **Site URL** bien configurado y `public/email/logo.png` desplegado.
- **Recordatorios y avisos de evaluaciones:** usan el mismo diseño (`shared/emailLayout.ts`, `server/mailer.ts#brandedMail`).
