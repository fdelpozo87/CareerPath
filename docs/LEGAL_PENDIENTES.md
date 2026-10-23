# Pendientes legales y de privacidad antes de abrir el servicio

`npm run legal:check` lista los textos de la política que todavía están entre corchetes y falla mientras haya alguno.
Los textos viven en `shared/locales/es.json` y `en.json` (claves `privacy.*`); después de editarlos, `npm run i18n`.

## Datos que solo puede aportar Rubika Tech

| Qué | Dónde (clave) |
|---|---|
| CUIT, domicilio y email de contacto de privacidad | `privacy.s2.body`, `privacy.s6.body` |
| Plazo de conservación de cuentas inactivas | `privacy.s5.body` |
| Plazo de conservación del registro de actividad de administración | `privacy.s3.e.rest` |
| Transferencia internacional de datos (Google, Vercel, Supabase, Resend, Sentry procesan fuera de Argentina) | `privacy.s4.outside` |
| Condiciones de retención y uso de datos del plan de Gemini | `privacy.s4.g.rest` |
| Región del proyecto de Supabase y condiciones vigentes | `privacy.s4.sb.rest` |
| Condiciones vigentes de Resend | `privacy.s4.r.rest` |
| Evaluaciones de desempeño: rol de cada parte y plazo de conservación | `privacy.s3.f.rest` |

## Revisión legal

- El texto es un **borrador**; la versión en inglés es una traducción del español y también necesita revisión.
- Ley 25.326 (protección de datos personales): evaluar si hay que **inscribir la base de datos** en el registro de la
  Agencia de Acceso a la Información Pública, y qué leyenda de consentimiento corresponde en el formulario de registro.
- Si se ofrece a personas de otros países, revisar el régimen que les aplique (por ejemplo, GDPR en la Unión Europea).

## Lo que ya está resuelto en el producto

- Sin cuenta, la conversación **no se guarda en servidores**; vive en el navegador.
- Con cuenta, solo se guardan email, informe y compromisos (nunca la conversación).
- La persona puede **descargar todo** (“Descargar mis datos”) y **borrar su cuenta y sus datos** desde el menú, sin pedir nada.
- Las contraseñas las guarda Supabase Auth con hash; no pasan por nuestro servidor ni por los logs.
- Los límites de uso guardan una huella de la IP, no la IP; los logs identifican a la persona por etiqueta, no por dato personal.
- La búsqueda de datos de mercado usa una consulta genérica, sin datos personales.

## Evaluaciones de desempeño: puntos legales específicos

Tratan datos de personas en una relación de trabajo, con quien evalúa y quien es evaluado como partes distintas. Antes de
ofrecerlas a empresas reales:

- Definir si **la empresa es responsable** de los datos de sus empleados y Rubika Tech es **encargada del tratamiento**, y
  firmar el acuerdo que corresponda. Hoy la política no lo dice.
- **Consentimiento y transparencia:** la pantalla avisa a quien responde, antes de escribir, quién va a leer sus respuestas;
  falta el texto legal definitivo.
- **Sin decisiones automatizadas:** el producto no pone notas ni recomienda sanciones, ascensos ni despidos (ver Ley 25.326
  sobre decisiones basadas únicamente en tratamiento automatizado). Mantener esa regla en cualquier cambio futuro.
- **Temas prohibidos** en las preguntas y los informes (edad, género, salud, embarazo, religión, afiliación, etc.): están
  en el prompt, pero conviene que el equipo legal revise la lista.
- Plazo de conservación de las evaluaciones y de los informes, y qué pasa cuando alguien deja la empresa.

## Decisiones de producto que tocan privacidad (a definir)

- ¿Se borran solas las cuentas inactivas pasado cierto tiempo? Hoy no: requeriría un cron como el de recordatorios.
- ¿Cuánto se conserva el registro de actividad del panel?
- ¿Se pide aceptar los términos al registrarse (casilla o pantalla previa)? Hoy el enlace a la política está a la vista pero no hay aceptación explícita.
