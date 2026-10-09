# Seguridad, calidad y operación — Bivio

Auditoría del 30/09/2026 sobre la rama `feat/agente-conversacional`. Cada punto indica el estado **hoy** y, para lo que todavía no existe (base de datos, login, pagos), el diseño con el que hay que construirlo.

| # | Tema | Estado |
|---|------|--------|
| 1 | API keys y secretos | ✅ Revisado y corregido |
| 2 | Permisos de DB y RLS | 🔜 Diseño listo (abajo) — no hay DB todavía |
| 3 | Auth | ✅ Acceso de prueba por código (para el período de pruebas) · 🔜 login con cuentas, diseño listo |
| 4 | Acceso a datos propios únicamente | ✅ Hoy por diseño · 🔜 RLS al sumar DB |
| 5 | Inyección SQL y XSS | ✅ Revisado |
| 6 | Límite de peticiones | ✅ Implementado (primera barrera) · ⚠️ falta regla global en Vercel |
| 7 | Dependencias vulnerables | ✅ 0 vulnerabilidades |
| 8 | Endpoints funcionando | ✅ 25 tests automáticos |
| 9 | Anti-error | ✅ Implementado |
| 10 | Logs sin información sensible | ✅ Implementado |
| 11 | Pruebas automáticas de login | 🔜 Diseño listo — no hay login todavía |
| 12 | Comprobantes de pago | 🔜 Diseño listo — no hay pagos todavía |
| 13 | Backups | 🔜 Diseño listo — hoy no hay datos en servidor |
| 14 | Responsive | ✅ Verificado |
| 15 | Llamadas a la API y tiempo de carga | ✅ Revisado |
| 16 | Estados de carga, error y ausencia de datos | ✅ Revisado |
| 17 | Accesibilidad | ✅ 0 violaciones WCAG 2.1 AA (axe) y teclado corregido · ⚠️ falta la prueba manual con VoiceOver (guion listo) |
| 18 | Analytics y onboarding | ✅ Implementado |
| 19 | Monitoreo de errores | ✅ Implementado · ⚠️ falta crear el proyecto en Sentry |
| 20 | Legales y política de privacidad | ✅ Borrador · ⚠️ falta revisión legal |

---

## 1. API keys y secretos

- `GEMINI_API_KEY` vive solo en el servidor (sin prefijo `VITE_`). Se verificó que **no aparece en el bundle** (`dist/`) ni en el historial de git, y que `.env` está en `.gitignore`.
- **Corregido — proxy abierto:** `/api/analyze` recibía el prompt completo desde el navegador, así que cualquiera podía usar la key para lo que quisiera. Ahora el prompt de Empresas se arma en el servidor (`server/company.ts`) y el cliente solo manda las respuestas del formulario, validadas campo por campo.
- **Corregido — errores crudos:** los errores del proveedor (con URLs, nombre del modelo y detalles) llegaban a la pantalla. Ahora el cliente recibe un mensaje genérico (`publicError`) y el detalle va al log, con las keys redactadas.
- `/api/coach` solo acepta modos y campos conocidos, con topes de tamaño (`server/coach.ts → validate`).

**Pendiente de operación:** cargar `GEMINI_API_KEY` en Vercel → Settings → Environment Variables (Production y Preview). Si alguna vez la key se comparte por chat o captura, rotarla en Google AI Studio.

## 3 (período de pruebas). Acceso por código de invitación

**El problema:** al subir la app a Vercel, cualquiera con el link puede usarla y gastar tu cuota de Gemini. Para el período de pruebas se agregó una puerta de acceso, **validada por el servidor** (no solo una pantalla):

- Cada persona de prueba recibe un **código personal** (`K7QM-X2PD-9RTA`). Sin un código válido, **`/api/coach`, `/api/analyze` y `/api/access` no responden**: ni siquiera se llega a Gemini.
- En el navegador se muestra una pantalla de "pruebas privadas". El código se recuerda para no pedirlo en cada visita y viaja en un header en cada pedido.
- **Falla cerrada:** en Vercel, si `ACCESS_CODES` no está configurada, la API responde 503 en vez de quedar abierta. Un deploy mal configurado nunca expone tu cuota. En local, sin la variable, no se pide código.
- **Cada código tiene su tope diario** (400 pedidos/día ≈ 10–15 sesiones completas), así que lo máximo que puede gastar una persona está acotado.
- **Contra la adivinanza:** los códigos tienen 12 caracteres (~59 bits), se comparan por hash y en tiempo constante, y tras 10 intentos fallidos desde una IP se bloquea el acceso por 10 minutos. No se aceptan códigos de menos de 8 caracteres.
- **Trazabilidad:** los logs registran la **etiqueta** de quien usó la app (`"who":"ana"`), nunca el código. Sirve para saber cuánto usó cada persona.
- **Si la revocás:** al próximo pedido la persona vuelve a la pantalla de acceso y, al reingresar con otro código, retoma su conversación desde lo guardado.

### Cómo se configura

1. Generar códigos (uno por persona):
   ```bash
   npm run access:code -- ana luis marta
   ```
2. Pegar la línea `ACCESS_CODES=...` que imprime en Vercel → Settings → Environment Variables (Production **y** Preview) y redeployar.
3. Entregar cada código **por un canal privado** (mensaje directo, no un grupo).
4. Para **revocar** a alguien: sacar su entrada de `ACCESS_CODES` y redeployar. Para **rotar** todo: generar códigos nuevos.

### Qué es y qué no es

- **Es** una puerta de invitación para proteger el costo mientras se prueba. Alcanza para el objetivo.
- **No es** un login con cuentas: no identifica personas reales, y si alguien comparte su código, quien lo reciba entra (por eso cada uno tiene su tope diario y su etiqueta en los logs). Tampoco guarda nada en servidor.
- **Complementa, no reemplaza,** el tope de gasto mensual en Google AI Studio: es la última red de seguridad por si algo falla.
- Los códigos están en variables de entorno de Vercel: no van al repositorio ni al navegador (el bundle solo guarda el código que la persona escribió).
- Cuando haya cuentas (Supabase, abajo), esta puerta se reemplaza por el login: el servidor pasa de validar un código a validar un token.

**Alternativa de Vercel:** *Deployment Protection* (contraseña o Vercel Authentication) protege todo el sitio sin escribir código, pero según el plan suele exigir que cada persona tenga cuenta en tu equipo de Vercel o una opción paga. Por eso se eligió el código propio: sirve en el plan gratuito y para personas externas. Conviene verificar las condiciones vigentes del plan.

## 2, 4 y 11. Base de datos, RLS, aislamiento de datos y pruebas de login (diseño)

Hoy **no hay base de datos ni cuentas**: la sesión vive en el `localStorage` del navegador de cada persona, así que nadie puede ver los datos de otra. El servidor no guarda nada.

Cuando se sume login, la propuesta es **Supabase** (Auth + Postgres con Row Level Security):

### Auth
- Email con *magic link* o código OTP (sin contraseñas que custodiar) y, opcionalmente, Google.
- La clave `anon` puede estar en el frontend; **la `service_role` nunca** (solo en funciones del servidor, y solo si hace falta).
- Las funciones `/api/*` validan el JWT de Supabase (`supabase.auth.getUser(token)`) antes de llamar a Gemini, y el rate limit pasa a ser por `user_id` además de por IP.

### Esquema y RLS

```sql
create table public.coach_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  path text not null check (path in ('quiebre', 'perfil')),
  phase text not null,
  stage text not null,
  data jsonb not null,             -- mensajes, síntesis, informe
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.commitments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.coach_sessions on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  texto text not null,
  bloque text check (bloque in ('70', '20', '10')),
  tipo text check (tipo in ('pedido', 'oferta', 'accion')),
  done boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.coach_sessions enable row level security;
alter table public.commitments enable row level security;

-- Cada persona ve y modifica solo lo suyo. (select auth.uid()) se evalúa una vez por consulta.
create policy "sesiones propias" on public.coach_sessions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "compromisos propios" on public.commitments
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index on public.coach_sessions (user_id);
create index on public.commitments (user_id);
```

- **CV y LinkedIn:** por defecto no se guardan (minimización de datos). Si se decide guardarlos, van en un bucket **privado** de Storage con la política `(storage.foldername(name))[1] = auth.uid()::text`.
- Ninguna tabla queda sin RLS. Hay que revisarlo con el *Security Advisor* de Supabase antes de cada deploy.

### Pruebas automáticas (punto 11)
1. **Aislamiento (RLS):** test de integración con dos usuarios de prueba. A crea una sesión; B intenta leerla, actualizarla y borrarla → 0 filas o error. También sin sesión (anon) → 0 filas.
2. **Login E2E con Playwright:** en local con `supabase start` (los mails caen en el Inbucket local):
   - login con magic link → llega a "Retomar tu proceso";
   - logout → `/api/*` responde 401;
   - un token vencido o manipulado → 401;
   - el rate limit por usuario responde 429.
3. Se corren en CI (GitHub Actions) en cada PR, junto con `npm test`.

## 5. Inyección SQL y XSS

- **SQL:** no hay base de datos. Con Supabase se usa el cliente con consultas parametrizadas; nunca SQL armado con strings. Si hiciera falta SQL propio, van funciones `security invoker` con parámetros.
- **XSS:** React escapa todo el texto por defecto. Se verificó que no hay `dangerouslySetInnerHTML`, `innerHTML` ni `eval` en el código. Las respuestas del modelo se muestran como texto, nunca como HTML.
- **CSP** en `vercel.json`: solo scripts propios (`script-src 'self'`), sin `iframe` de terceros (`frame-ancestors 'none'`), `object-src 'none'`. Además: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` y `Permissions-Policy`.
- **Inyección de prompts** (el equivalente en apps con IA): el perfil y los documentos van delimitados y marcados como contexto. El servidor no confía en el modelo para avanzar de etapa: lo verifica él mismo. Lo peor que puede lograr alguien con un prompt malicioso es una respuesta rara en su propia sesión: no hay datos de otras personas a los que acceder.

## 6. Límite de peticiones

Implementado en `server/guard.ts`, aplicado antes de validar y de llamar a Gemini:

| Regla | Límite por IP |
|---|---|
| Conversación (turnos, informe) | 20 / minuto |
| Documentos (leer PDF, lectura de perfil, análisis de Empresas) | 10 / hora |
| Total | 150 / hora |

Además: solo se aceptan pedidos que vengan del propio sitio (`Origin`), body máximo de 4,5 MB, historial máximo de 120 mensajes y timeout de 45 segundos hacia Gemini.

⚠️ El límite vive en la memoria de cada instancia de Vercel: frena ráfagas, pero no es global. **Antes de abrir al público:**
- Vercel → Firewall → *Rate limiting rule* sobre `/api/*`, por ejemplo 60 req/min por IP; o
- `@upstash/ratelimit` con Redis (plan gratuito) para un límite global.
- En Google AI Studio, configurar un **tope de gasto mensual** de la key. Es la última red de seguridad del bolsillo.

## 7. Dependencias

- `npm audit`: **0 vulnerabilidades**. Antes eran 10 (7 altas), todas en dependencias de desarrollo.
- Se eliminó `@vercel/node`: solo se usaba por dos tipos y arrastraba `undici`, `path-to-regexp` y `ajv` vulnerables. Los tipos están en `server/http.ts`.
- Recomendación: activar **Dependabot** en GitHub (Settings → Code security) y correr `npm audit` en CI.

## 8. Endpoints

`npm test` corre 25 pruebas en `tests/endpoints.test.ts`, con Gemini simulado (sin costo):
- método, origen y rate limit;
- validación de payloads;
- gating de etapas (§3 del guardrail);
- reintento ante JSON roto;
- que no se filtren ni la key ni los errores crudos;
- modo demo;
- que `/api/analyze` ya no sea un proxy abierto;
- el acceso por código: sin código o con uno incorrecto no se llama a Gemini, el código válido entra sin importar mayúsculas o separadores, falla cerrada en Vercel sin configurar, bloqueo tras intentos fallidos, tope diario por código y que los logs no muestren el código.

Se probó además contra el servidor local con `curl`: 403 sin origen o con otro origen, 405 con GET, 400 con JSON roto o prompt arbitrario, 413 con body gigante y 429 al pasar el límite.

## 9. Anti-error

- **Servidor:** un reintento automático ante fallas transitorias de Gemini (429/5xx, timeout, JSON incompleto), con espera creciente. Mensajes amables según el caso: sobrecarga, contenido bloqueado o respuesta incompleta.
- **Cliente:**
  - timeout de 60 segundos;
  - detección de "sin conexión";
  - botón **Reintentar** en el chat y en el informe;
  - si la persona cierra la pestaña a mitad de una respuesta, al retomar se le ofrece reintentar.
- **`ErrorBoundary`:** si falla un componente, se muestra una pantalla de "Recargar" en vez de una pantalla en blanco, y el progreso no se pierde.

## 10. Logs

`logEvent` en `server/guard.ts` escribe JSON estructurado en los logs de Vercel con endpoint, modo, estado, duración y un **hash de la IP**. **Nunca** registra el contenido de la conversación ni de los documentos, y redacta keys y tokens de los mensajes de error.

## 12. Comprobantes de pago (diseño)

Con Mercado Pago (Argentina) o Stripe:
- **El pago se confirma solo por webhook, nunca por la redirección del navegador.** Se verifica la firma del webhook (`x-signature` en Mercado Pago, `Stripe-Signature` en Stripe) con el secreto guardado en el servidor.
- **Idempotencia:** una tabla `payment_events (event_id unique)`, así un webhook repetido no acredita dos veces.
- El monto y el plan se validan en el servidor contra el catálogo, nunca con lo que manda el cliente.
- El acceso pago (tabla `entitlements`) solo lo escribe el servidor; con RLS, la persona solo puede leer el suyo.
- **Tests:**
  - sandbox con las tarjetas de prueba del proveedor;
  - pago aprobado, rechazado y pendiente;
  - webhook con firma inválida → 401;
  - webhook duplicado → sin doble acreditación.

## 13. Backups (diseño)

- **Hoy:** no hay datos en servidor. Los datos de cada persona están en su navegador y el informe se puede guardar en PDF ("Imprimir / guardar PDF").
- **Con Supabase:**
  - el plan Pro incluye backups diarios;
  - sumar *Point-in-Time Recovery* cuando haya usuarios pagos;
  - además, un `pg_dump` semanal cifrado a un storage externo con una GitHub Action.
- **Probar la restauración** una vez por trimestre: un backup que nunca se restauró no está probado.
- El código ya está respaldado en GitHub, y cada deploy de Vercel se puede volver atrás (*Instant Rollback*).

## 14. Responsive

Probado a 375 px (móvil) y en escritorio, sin scroll horizontal. En móvil, el panel de progreso del chat se compacta en chips y el input queda fijo abajo, sin tapar el último mensaje.

## 15. Llamadas a la API y tiempo de carga

- Bundle inicial de ~84 KB gzip. Sentry solo se descarga si está configurado; si no, no suma nada.
- Una sola llamada a Gemini por turno. El historial tiene un tope de 100 mensajes y los documentos de 15.000 caracteres cada uno.
- El system prompt es estable dentro de cada etapa, lo que aprovecha el *cache* implícito de Gemini y abarata los turnos.
- **Speed Insights de Vercel** agregado, para medir Core Web Vitals reales. Se activa en el dashboard de Vercel → Speed Insights.

## 16. Estados de carga, error y ausencia de datos

- **Carga:** indicador de "escribiendo" en el chat y pantallas de espera al leer documentos y al armar el informe.
- **Error:** mensaje claro con Reintentar en cada paso.
- **Sin datos:**
  - una sesión guardada corrupta o de una versión anterior se descarta sin romper nada;
  - una sesión retomada a mitad de un pedido ofrece reintentar;
  - sin API key, la app funciona en modo demo con un aviso visible.

## 17. Accesibilidad

Auditoría con **axe-core** (WCAG 2.0/2.1 A y AA más buenas prácticas) sobre la landing, la privacidad, el formulario del Camino B, el chat y el informe: **0 violaciones**. Correcciones:
- **Contraste:** el naranja `#f97316` como texto daba 2,7:1 y el blanco sobre los botones naranjas, 2,8:1. Se sumó un tono `primary-ink` (`#c2410c`, 5:1) para texto y botones. Los colores de etapa y el gris secundario se ajustaron a ≥ 4,5:1.
- **Estructura:** un `h1` por pantalla y un orden de encabezados correcto.
- **Chat:** el chat es una región `role="log"` con `aria-live`, así los lectores de pantalla anuncian cada respuesta nueva.
- **Teclado:** foco visible en todos los elementos interactivos.

Además de lo automático, se corrigió lo que axe **no detecta** (se encontró revisando el código):
- **Carga de PDF con teclado:** las zonas de carga (CV, LinkedIn y el flujo de Empresas) eran un `div` con click, inalcanzable con Tab. Ahora son botones reales: reciben foco y se activan con Enter o Espacio.
- **Estado de los grupos de opciones:** los botones "PDF / Pegar texto" y las tarjetas de caso de Empresas indican cuál está activo (`aria-pressed`), no solo por color.
- **Foco al cambiar de pantalla:** al entrar al chat, cambiar de etapa u abrir la lectura o el informe, el foco va al título (antes se perdía) y el lector anuncia dónde estás.
- **Panel de progreso:** cada objetivo dice "cubierto" o "pendiente" para lectores de pantalla; antes dependía del ícono y del color. La barra de etapas marca el paso actual.
- **Anuncios:** el indicador "el coach está escribiendo" (antes no se leía), los errores (`role="alert"`) y los estados de espera (`role="status"`).

**Pendiente:** la prueba manual con **VoiceOver y solo con teclado**. El guion paso a paso, con resultado esperado y tabla para anotar, está en [`PRUEBA_ACCESIBILIDAD.md`](./PRUEBA_ACCESIBILIDAD.md). Después, repetirla en el iPhone.

## 18. Analytics y onboarding

- **Embudo en Vercel Analytics**, sin cookies: camino elegido, inicio del diagnóstico, cada etapa completada, lectura de perfil, derivación, informe generado, compromisos asumidos, sesión retomada, errores del cliente (solo el tipo) y visitas a la política de privacidad.
- **Onboarding:**
  - la landing V1 presenta los dos caminos;
  - una tarjeta al inicio del chat explica cómo funciona (preguntas sin respuestas correctas, tres etapas y progreso visible, progreso guardado en el navegador);
  - el panel lateral muestra qué se va cubriendo.

## 19. Monitoreo de errores

- **Cliente:** `ErrorBoundary` + captura de `error` y `unhandledrejection` → evento `client_error` en Analytics y, si está configurado, **Sentry**. Sentry no recolecta datos de usuario, cookies, headers ni cuerpos, descarta los breadcrumbs de consola y de inputs, y trunca los mensajes.
- **Servidor:** logs estructurados en Vercel (errores de Gemini, reintentos y 5xx).
- **Para activarlo:**
  1. crear un proyecto en sentry.io (plan free) y cargar `VITE_SENTRY_DSN` en Vercel;
  2. en Vercel → Logs, crear una alerta por `level: error`.

## 20. Legales

Hay un borrador de **Privacidad y términos** en `#privacidad` (enlazado desde el footer, el onboarding y la carga de documentos). Está escrito a partir de lo que la app hace realmente: qué datos, para qué, proveedores (Google, Vercel, Sentry), almacenamiento local, derechos bajo la Ley 25.326 y descargo de "no reemplaza asesoramiento profesional".

⚠️ **Tiene que revisarlo un/a abogado/a antes de publicarlo.** Falta completar:
- razón social, CUIT, domicilio y email de contacto;
- las condiciones vigentes de uso de datos del plan de Gemini contratado;
- las transferencias internacionales.

Cuando se sumen cuentas y pagos, hay que actualizarlo: base de datos, retención, borrado de cuenta y procesador de pagos.

---

## Checklist antes del deploy

- [ ] **`ACCESS_CODES` cargada en Vercel** (Production y Preview), con los códigos entregados por un canal privado. Sin esto, la API no responde.
- [ ] `GEMINI_API_KEY` (y opcionalmente `GEMINI_MODEL`) cargadas en Vercel.
- [ ] Tope de gasto mensual configurado en Google AI Studio.
- [ ] Regla de rate limit en Vercel Firewall para `/api/*`.
- [ ] Si hay dominio propio, agregarlo a `ALLOWED_ORIGINS`.
- [ ] (Opcional) Proyecto en Sentry y `VITE_SENTRY_DSN`.
- [ ] Speed Insights activado en el dashboard de Vercel.
- [ ] Política de privacidad revisada por un/a abogado/a y con los datos completos.
- [ ] Recursos del protocolo de derivación validados por el equipo.
- [ ] Dependabot activado en GitHub.
