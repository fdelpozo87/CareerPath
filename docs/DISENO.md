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
