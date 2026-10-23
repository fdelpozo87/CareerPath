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
   Al enviar recibe el informe. **Es solo suya por defecto**; ella puede decidir compartirla (ver abajo).

## El puntaje de quien evalúa (1 a 5)

Cuando la persona envía su autoevaluación, **quien creó la evaluación puntúa cada competencia de 1 (muy malo) a 5 (muy
bueno)**, con un comentario opcional, y lo guarda con “Guardar y compartir puntajes”. Reglas:

- **Lo decide una persona, nunca el modelo:** la IA no ve ni calcula puntajes, y no se muestran promedios ni totales.
- **Todas las competencias** deben tener puntaje; solo puede puntuar quien creó la evaluación, y solo después de que la
  persona la envió. Se puede actualizar cuando se quiera.
- **La persona lo ve apenas se guarda**, debajo de cada competencia, junto a su propio nivel y su ejemplo, y recibe un
  aviso por email si Resend está configurado. Antes de compartir, la pantalla le avisa a quien evalúa que la otra persona
  lo verá.
- La escala de la persona (Aún no / En desarrollo / Sólido / Referente) se mantiene aparte: son dos miradas distintas que
  se ven lado a lado. Las evaluaciones propias (“Evaluarme”) no tienen puntaje de otra persona.
- En “Las que creé” se ve qué falta puntuar. Requiere `supabase/migrations/20261025000000_bivio_puntajes.sql`.

## Compartir una autoevaluación propia

Quien se evaluó por su cuenta (“Evaluarme”) y ya la envió puede **compartirla con otra cuenta de Bivio** (por ejemplo, su
jefe o jefa): esa persona la lee, con respuestas e informe, **en solo lectura**. La decisión es siempre de ella: nada se
comparte por defecto, ve con quién la compartió, puede **dejar de compartirla** cuando quiera (el acceso se corta en el
acto) y se pide confirmación antes de compartir. Máximo 5 personas; cada destinatario necesita una cuenta activa y recibe un
aviso por email si Resend está configurado. Quien la recibe la encuentra en **“Compartidas conmigo”**. Una evaluación
**asignada por un jefe** no se puede compartir con terceros. Requiere
`supabase/migrations/20261026000000_bivio_compartidas.sql`.

## Quién ve qué

| | Quien responde | Quien creó la evaluación | Terceros |
|---|---|---|---|
| Contenido de la evaluación | sí | sí | no (404) |
| Respuestas e informe | siempre | **solo cuando la persona los envía** | no (404) |
| Puntaje de 1 a 5 y comentarios | sí, apenas se guardan | sí (es quien puntúa) | no (404) |
| Responder o enviar | sí, hasta enviar | no | no |
| Puntuar | no | sí, tras el envío | no |
| Eliminar | no | sí (con las respuestas de todos) | no |
| Evaluación propia (“Evaluarme”) | solo ella, y a quien ella elija compartirla | — | no (404) |

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
- No hay todavía ciclos periódicos ni vista por equipo, ni un puntaje general (hoy es por competencia).
- La versión Jaspr no tiene esta sección.
- Ver los puntos legales pendientes en docs/LEGAL_PENDIENTES.md antes de ofrecerlo a empresas reales.

## Impresión / PDF

Al imprimir una evaluación (o guardarla como PDF) se oculta la interfaz y sale un documento con el logo, el título, la persona, la
fecha de envío y quien la asignó; las respuestas se muestran completas (sin cuadros de texto cortados), con la escala de nivel, el
ejemplo y el puntaje de la jefatura, y las tarjetas no se parten entre páginas.
