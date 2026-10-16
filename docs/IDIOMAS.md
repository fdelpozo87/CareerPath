# Idiomas (español neutro e inglés)

Bivio se muestra en **español neutro latinoamericano** y en **inglés**. La persona elige con el
selector `ES · EN` de la cabecera; si no eligió, se usa el idioma de su navegador. El coach también
responde en el idioma elegido.

## Dónde viven los textos

Una sola fuente, compartida por React, Jaspr y el servidor:

- `shared/locales/es.json` y `shared/locales/en.json` — claves planas (`landing.title`, `chat.next.plan`…).
- `node scripts/gen-i18n.mjs` (o `npm run i18n`) genera:
  - `shared/locales/dictionaries.ts` → React y servidor,
  - `web_jaspr/lib/i18n/strings.g.dart` → Jaspr.
- **Ambos archivos generados se commitean.** `npm run i18n:check` verifica que los dos idiomas tengan
  las mismas claves y las mismas variables `{nombre}`, y los tests fallan si los JSON y lo generado
  no coinciden.

### Agregar o cambiar un texto

1. Escribir la clave en `es.json` **y** en `en.json` (mismas `{variables}`).
2. `npm run i18n`.
3. Usarla: React `tr('clave', { var })` / `trn('base', n)` (plural: `base.one` y `base.other`);
   Jaspr `tl('clave', {'var': v})` / `tln('base', n)`.

Los componentes llaman a `tr()` / `tl()` al dibujarse; `App` se vuelve a dibujar al cambiar el
idioma, así que **no hay que guardar textos traducidos en constantes de módulo** (usar funciones).

## Voz del español

- **Tuteo ("tú")**, nunca voseo ni regionalismos: "cuéntame", "puedes", "aquí" (no "contame", "podés", "acá").
- Cálido, sin frases corporativas. Un test (`ningún texto en español usa voseo`) vigila los diccionarios
  y los prompts.
- El inglés va en tono equivalente: cercano, simple, sin jerga.

## El coach y el idioma

- El cliente manda `lang` (y el header `x-lang`) en cada pedido. Las instrucciones ocultas de apertura de
  etapa (`srv.open.*`) van en el idioma de la interfaz.
- `server/prompts.ts` agrega una sección de idioma al prompt y `server/coach.ts` pone una nota de idioma
  en el último mensaje. Si la respuesta sale en el otro idioma, `server/lang.ts` la detecta y se reintenta
  una vez (salvo que la persona misma esté escribiendo en ese otro idioma: entonces se le contesta en el suyo).
- Los mensajes de error y los textos fijos del servidor (`srv.*`) se traducen según `x-lang`.

## Pendientes conocidos

- **Política de privacidad en inglés:** es una traducción del borrador en español y está marcada como
  pendiente de revisión legal.
- **Recursos de derivación** (911, 107, Línea 144): son de Argentina y se rotulan así; para otros países
  hay que sumar los locales.
- **Modo demo** (sin `GEMINI_API_KEY`) y los resultados de ejemplo de Empresas siguen en español.
- **Empresas** no existe todavía en la versión Jaspr.
