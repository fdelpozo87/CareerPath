# Sistema visual de Bivio

La paleta la define el equipo de diseño y vive en un solo lugar: los tokens de `src/index.css` (la versión Jaspr compila
el mismo archivo). Para cambiar un color, se cambia el token, no los componentes.

## Paleta

| Nombre | Hex | Token | Uso |
|---|---|---|---|
| Violeta | `#6A3FC1` | `--color-primary`, `--color-brand` | Color de marca, botones principales, logo |
| Violeta profundo | `#3E2280` | `--color-primary-dark` | Hover y titulares |
| Lila suave | `#E9E2FA` | `--color-primary-soft` | Tarjetas y chips |
| Mandarina | `#F28C38` | `--color-accent` | **Relleno**: la opción elegida y la acción de avanzar |
| Durazno | `#FDE6D3` | `--color-accent-soft` | Fondos cálidos, opción elegida |
| Tinta | `#1F1533` | `--color-foreground`, `--color-ink` | Texto y logo |
| Gris violáceo | `#6B6478` | `--color-text-muted` (ajustado, ver abajo) | Texto secundario |
| Bruma | `#FAF9FC` | `--color-background` | Fondo general |
| Niebla | `#F8F5FF` | (gradientes del vidrio) | Bloques destacados |

Gamas dentro de la paleta: `--color-secondary` `#F1ECFB` (hover y chips), `--color-border-color` `#E3DCF3`, y en modo
oscuro un violeta claro `#B79CF2` como primario (el violeta de marca no tiene contraste sobre fondos oscuros), Tinta
como tarjeta y un fondo `#150E24`.

## Reglas

- **El mandarina nunca es texto** (2,3:1 sobre claro). Es un relleno, siempre con texto Tinta encima (7,1:1). Para
  texto de acento sobre fondos claros se usa `--color-accent-ink` (`#8F4300`, 6,7:1).
- **Acciones:** `btn-primary` (violeta) para lo general y `btn-advance` (mandarina) para **avanzar** (“Seguir a…”,
  “Empezar la conversación”). La opción elegida (acciones del informe, cambios de la lectura de perfil) se marca con
  borde mandarina y fondo durazno.
- **Dónde va el mandarina** (la señal de "aquí va tu mirada" y "esto es lo que sigue"; como mucho un punto por pantalla):
  la acción de avanzar (“Seguir a…”, “Empezar la conversación”, **“Asumir N compromisos”**), la **etapa actual** en la
  barra de progreso (las completadas quedan en violeta), el **proceso más reciente** en “Tus procesos” (“Retomar”) y la
  opción elegida. No va en texto, enlaces, íconos, errores, foco del teclado, panel de administración ni en el botón de
  enviar del chat. También el borde de la tarjeta de camino al pasar el mouse o enfocarla, y el filete de “Para completar tu plan”.
- **Sin rojo y verde de semáforo:** Bivio no aprueba ni desaprueba. Lo negativo y lo positivo se distinguen con
  mandarina oscuro y violeta, nunca con rojo ni verde. Los avisos de error usan un naranja oscuro (`--color-danger`).
- **Texto secundario:** `#5E566D` en lugar de `#6B6478`, un poco más oscuro, para sostener AA (≥ 5,5:1) también sobre
  chips lilas. El valor de la paleta da 4,5:1 sobre lila: justo en el límite.
- **Contrastes (WCAG AA):** texto Tinta sobre Bruma 16,5:1; blanco sobre Violeta 6,8:1; Violeta sobre Bruma 6,5:1; en
  modo oscuro texto 7–16,7:1 y texto sobre el botón primario 7,5:1.

## Tipografía y marca

- Títulos en **Plus Jakarta Sans** (700) y texto en **DM Sans**, servidas desde el propio sitio (`src/fonts.css`, paquetes `@fontsource-variable`, solo alfabeto latino). No se le pide nada a Google: menos conexiones, carga más rápida y CSP cerrada (`font-src 'self'`). Los tokens `--font-display` y `--font-sans` viven en `src/index.css`.
- El logo (`src/components/Logo.tsx`) es un trazo violeta que sube y se curva hacia un punto mandarina, con la palabra "bivio" y los puntos de las dos "i" en violeta y mandarina. El favicon, los íconos, las imágenes para compartir (`og-image*.png`) y el logo de los mails (`public/email/logo.png`) se generan con `npm run brand` (`scripts/gen-brand-assets.mjs`, usa Chrome): si cambia la marca o el texto de la portada, se vuelve a correr y se commitean los archivos. Los mails usan el logo completo (símbolo y palabra) como imagen y una sans gruesa del sistema para los títulos, porque los clientes de correo no cargan tipografías web.
- La pantalla de entrada tiene el formulario a la izquierda y un panel de marca a la derecha (`--color-panel`, violeta fijo en claro y oscuro).

## Inicio: los tres caminos

- Cada camino tiene un dibujo propio (`src/components/PathIllustrations.tsx`): A una bifurcación, B un CV con lupa y C tres opciones de formación con una resaltada. Los fondos son durazno, lila y bruma, y los colores salen de los tokens, así que siguen el modo oscuro.
- Los dibujos están quietos y se animan solo con el mouse o el foco del teclado sobre la tarjeta (reglas `.pa-*` en `src/index.css`); con "reducir movimiento" no se mueven.
- Arriba va el saludo "Hola, {nombre}. ¿Por dónde quieres empezar hoy?" (la segunda frase en violeta profundo). `Landing` recibe `name` (todavía no se le pasa: sin nombre dice solo "Hola.").
- Sin procesos guardados, "Elige tu primera sesión" y tres tarjetas grandes. Con procesos, "Tus procesos" (con barra de etapas) a la izquierda y "Empezar una nueva" con tarjetas compactas a la derecha.

## Inicio de una sesión y progreso

- Al abrir un camino nuevo se ve primero **"Esto es lo que vamos a hacer"** (`SessionIntro.tsx`): tres líneas según el camino y el botón
  "¿Empezamos?". Recién ahí se le pide al coach la primera pregunta (o, en el camino B, se pasa a cargar el perfil). Una sesión
  retomada no la muestra.
- **Camino A: la apertura es un texto fijo** (`src/lib/coach/opening.ts`, clave `chat.opening.quiebre`), no lo escribe el modelo: "Hola. Te acompaño en este espacio…". Así es siempre igual y no gasta una llamada. Se guarda con la forma de un turno del coach (tema `goal` ya preguntado) para que el resto de la conversación lo lea como siempre. Los caminos B y C siguen abriendo con el modelo.
- **No hay etapa 0 ni bloque "Antes de empezar"**: la conversación abre con la primera pregunta y, debajo, algunas frases para
  quien le cuesta empezar. El enlace "Cómo cuidamos tus datos" quedó en el pie del chat.
- El progreso es una **onda** (`StageWave.tsx`): una ondulación por etapa, con puntos de cierre y el punto mandarina del logo que
  avanza según los temas cubiertos. Es un `progressbar` accesible y respeta "reducir movimiento".

## Camino A: el CV y el LinkedIn se piden en la charla, no al empezar

- En el Camino A **no hay** botón "Sumar mi CV o LinkedIn" en el encabezado (en B y C sigue). El coach decide en cada turno si
  ver el CV o el LinkedIn le serviría y, si es así, devuelve `pideDocumentos` (`["cv"]`, `["linkedin"]` o ambos) y lo dice en su
  mensaje; la pantalla muestra debajo la tarjeta para sumarlo (`Offers.tsx`), con "Ahora no". También puede devolver
  `sugiereCamino: "perfil"`: aparece la tarjeta "Esto también se puede trabajar en el Camino B", con "Ir al Camino B" (la conversación
  queda guardada) y "Seguir aquí".
- **El servidor limita las ofertas** (`normalizeOffers` en `server/coach.ts`, probado en `tests/ofertas.test.ts`), sin depender de que
  el modelo se acuerde: solo en el Camino A; documentos a partir de la 2.ª respuesta de la persona y sugerencia del Camino B a partir
  de la 3.ª; nunca en el cierre de una etapa, ante una derivación ni en el Plan de Acción; cada oferta una sola vez por conversación
  (se mira el historial) y nunca los documentos que ya se sumaron; si el mismo turno trae las dos, solo la de documentos.
- Las instrucciones al modelo están en `OFERTAS_GUIDANCE` (`server/prompts.ts`): cuándo conviene, que sea opcional, que el
  documento es solo contexto (nunca para corregir) y que no insista.
- Para afinar el criterio del modelo con casos reales (cuándo pide y cuándo no) conviene sumar escenarios a `scripts/eval/escenarios.mjs`.

## Ikigai (Caminos A y C)

- Es un **tema más de la Exploración** (`ikigai`, se puede dejar para más adelante) y no existe en el Camino B ni en las otras etapas
  (`objectivesFor` en `shared/stages.ts`). En A va tras el obstáculo reencuadrado; en C, tras intereses y aptitudes, así no se
  repiten preguntas.
- El coach **pregunta, no lo nombra por la persona**: una mirada por turno (lo que ama, en qué se le da bien, qué necesita el mundo,
  por qué podrían pagarle). Nunca dice cuál es su ikigai ni qué camino le corresponde; el centro lo nombra ella. Las instrucciones
  están en `IKIGAI_GUIDANCE` (`server/prompts.ts`).
- Al cerrar la etapa, el mapa trae `ikigai: { ama, bueno, mundo, pagan }` con una frase corta por mirada. **El servidor verifica que
  cada frase salga de lo que la persona escribió** (`cleanIkigai` en `server/coach.ts`): una frase inventada queda en blanco, y con
  menos de dos frases no hay gráfico, solo el texto del tema.
- Se ve en el **mapa de la Exploración** y en el **informe final** (`IkigaiChart.tsx`): cuatro círculos que se cruzan en pantallas
  medianas y grandes, y una lista en celular y para lectores de pantalla. Las miradas que la persona no dijo dicen "Todavía no lo
  dijiste". El centro dice "Lo nombras tú". Es una herramienta para pensar, no un resultado, y así se aclara debajo.
- Una Exploración que ya estaba en curso cuando se sumó el tema lo suma como pendiente (se puede dejar para más adelante). El servidor no da por cerrada una etapa solo porque el cliente lo diga: sigue exigiendo todos los temas cubiertos u omitidos.

## Dónde más hay colores

- `public/favicon.svg` y `web_jaspr/web/favicon.svg` (violeta en claro, violeta claro en oscuro).
- Color de la barra del navegador: `public/prepaint.js`, `index.html`, `src/lib/theme.ts`, `web_jaspr/lib/services/theme.dart`.
- Mail del recordatorio: `server/reminders.ts` (HTML con estilos en línea).
- Sección de Empresas (`CompanyFlow.tsx`, `CompanySection.tsx`): usa gamas de violeta y mandarina oscuro.

## Web pública: buscadores, redes e IA

- `index.html`: título y descripción, canonical, Open Graph / Twitter (imagen `public/og-image.png`, 1200×630), datos estructurados
  (JSON-LD) y la portada en HTML inicial, que React reemplaza al arrancar. Cada pantalla pone su título en la pestaña (`meta.title.*`).
- `vite.site.ts` publica `robots.txt` (permite a los asistentes de IA, bloquea `/api/`), `sitemap.xml` y `llms.txt`, y completa la
  URL pública. **Con dominio propio alcanza con definir `SITE_URL` en Vercel** y redesplegar.
- `public/404.html` es la página de error con la marca; `site.webmanifest` e íconos (192, 512, apple-touch) para "instalar" la web.
- Las pantallas pesadas (coach, empresas, evaluaciones, administración, privacidad) se descargan al entrar: el primer paquete pasó de
  733 KB a 455 KB (128 KB comprimido). No se publican source maps.
- **Idioma en la URL:** `/es/` y `/en/`. Cada una es una portada estática (`vite.site.ts`) con su `lang`, título, descripción, canonical,
  `hreflang` (es, en, x-default), imagen para compartir (`og-image.png` / `og-image-en.png`) y contenido en el HTML inicial; el sitemap
  lista las dos con sus alternativas. La app lee el idioma de la URL (manda sobre lo guardado) y al cambiar el idioma actualiza la
  dirección sin recargar (`shared/langPath.ts`). "/" sirve la versión en español y la app la lleva al idioma guardado o del navegador;
  no se reescribe la dirección mientras trae un enlace de acceso de Supabase.
