# Evaluación del coach y CI

## CI (GitHub Actions)

`.github/workflows/ci.yml` corre en cada PR y en `main`: paridad de textos, lint, tests, build, que los archivos
generados de i18n estén al día, y `dart analyze` de Jaspr. Dependabot (`.github/dependabot.yml`) propone
actualizaciones de npm, pub y de las propias acciones.

## Evaluación del coach con Gemini real

Los tests unitarios no pueden decir si el modelo respeta el guardrail. `npm run eval` corre escenarios con guion
(Martín, Sofía y Lucía del análisis de UX, más menor de edad, acoso y pedido de solución) contra un servidor local y
revisa reglas que no dependen del azar: tuteo, sin género, sin promesas de mapa, sin "Discovery", una sola pregunta,
fuentes en los datos de mercado, derivación, que no decida por la persona.

```bash
REQUIRE_LOGIN=0 npm run dev                         # otra terminal, con GEMINI_API_KEY en .env
EVAL_URL=http://localhost:5173 npm run eval
npm run eval -- C-mercado                           # solo los escenarios que contengan ese texto
EVAL_REPEAT=3 npm run eval                          # el modelo no es determinista: repetir cada uno
EVAL_VERBOSE=1 npm run eval -- A-martin             # ver lo que dijo el coach
```

Gasta decenas de llamadas por corrida, así que **no corre en CI**: se usa a mano antes de mergear un cambio de prompt.
Los escenarios están en `scripts/eval/escenarios.mjs`.

### Qué ya encontró

- El prompt nombraba las palabras prohibidas ("acá", "estancado/a", "juntas") y el modelo las repetía: se quitaron los
  ejemplos negativos y se dejaron solo positivos.
- A veces el modelo contestaba "no tengo esos datos" en vez de pedir la búsqueda de mercado: ahora, si el mensaje lo es
  a todas luces (sueldo, costo, salida laboral), se le vuelve a pedir una vez.
- El saludo "Bienvenida" y el "juntas/juntos" salen por costumbre: hay una red de seguridad en el servidor
  (`neutralizeGender`, solo español).

### Lo que sigue fallando (variación del modelo)

En turnos posteriores el modelo todavía suelta de vez en cuando adjetivos con género ("parada", "agotada") en 1 de
cada 2 o 3 corridas de los escenarios del Camino A. Una lista de reemplazos en el servidor no escala, así que la
evaluación lo seguirá marcando hasta que se endurezca el prompt o se pruebe un modelo más grande
(`GEMINI_MODEL=gemini-3.5-flash`, ver `.env.example`).
