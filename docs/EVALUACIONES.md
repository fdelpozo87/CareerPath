# Evaluaciones de desempeño

Parte de **Para empresas**. Bivio no puntúa personas: ayuda a armar una autoevaluación con ejemplos concretos y a
preparar la conversación con un informe. La decisión sobre la persona es siempre humana.

## Dos flujos

1. **Asignada** — quien tiene “Para empresas” crea una evaluación (la IA propone competencias y preguntas, se editan y se
   pueden pedir cambios a la IA) y la asigna a emails. Cada destinatario **tiene que tener una cuenta activa de Bivio**:
   si no, no se asigna y se explica por qué (la cuenta la da de alta quien administra). Si Resend está configurado, le llega
   un aviso por email; si no, la ve en “Mis evaluaciones” al entrar. La persona se **autoevalúa**: un nivel (Aún no / En
   desarrollo / Sólido / Referente) y un ejemplo concreto por competencia, más qué quiere desarrollar. Al enviar, se genera el
   informe.
2. **Propia ("Evaluarme")** — cualquier cuenta con “Para profesionales” o “Para empresas” escribe su **área y su cargo**
   y empieza: la IA le arma la autoevaluación a medida y pasa directo a responderla, sin revisar una propuesta antes.
   Al enviar recibe el informe. Es solo suya: nadie más la ve.

## Quién ve qué

| | Quien responde | Quien creó la evaluación | Terceros |
|---|---|---|---|
| Contenido de la evaluación | sí | sí | no (404) |
| Respuestas e informe | siempre | **solo cuando la persona los envía** | no (404) |
| Responder o enviar | sí, hasta enviar | no | no |
| Eliminar | no | sí (con las respuestas de todos) | no |

Antes de escribir, la pantalla le dice a la persona quién va a leer lo que escriba. Todo lo aplica el servidor
(`server/evaluaciones.ts`): las tablas no son accesibles desde el navegador.

## El informe

Resumen, fortalezas y puntos de desarrollo **citando la evidencia que la persona escribió**, “para revisar juntos” (donde el
nivel elegido y el ejemplo no parecen coincidir, como pregunta específica y nunca como juicio), plan de desarrollo con
bloque 70-20-10 y plazo, y preguntas para la conversación. Sin puntaje total, promedio ni comparaciones.

## Guardarraíles del modelo

- Las preguntas piden hechos observables (situación, qué hizo, qué efecto), no rasgos ni opiniones.
- **Prohibido** preguntar o aludir a edad, género, estado civil, hijos o embarazo, salud o discapacidad, religión, ideas
  políticas, afiliación sindical, nacionalidad, origen étnico, orientación sexual y vida privada. Si quien crea la evaluación
  lo pide, la IA ignora esa parte, aplica el resto y lo explica en una nota.
- Lenguaje neutro y sin etiquetas de personalidad.

## Puesta en marcha

1. Correr `supabase/migrations/20261024000000_bivio_evaluaciones.sql` en el SQL Editor.
2. Para el aviso por email: `RESEND_API_KEY`, `REMINDER_FROM` y `APP_URL` en Vercel (ver docs/CUENTA.md). Sin eso, todo funciona
   pero no se manda email.
3. Dar “Para empresas” a quienes van a crear evaluaciones (panel de administración).

## Límites del MVP

- Cada destinatario necesita cuenta de Bivio (alta por el administrador).
- Hay un tope diario de generaciones e informes por persona (`RATE_RULES.evaluaciones`).
- No hay todavía evaluación del jefe para comparar lado a lado, ciclos periódicos ni vista por equipo.
- La versión Jaspr no tiene esta sección.
- Ver los puntos legales pendientes en docs/LEGAL_PENDIENTES.md antes de ofrecerlo a empresas reales.
