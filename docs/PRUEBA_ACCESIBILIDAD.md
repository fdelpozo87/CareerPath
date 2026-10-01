# Prueba manual de accesibilidad — VoiceOver y teclado

**Para qué sirve:** las herramientas automáticas (axe) ya dan 0 violaciones, pero detectan solo una parte de los problemas. Esta prueba mira lo que ninguna herramienta ve: **qué se escucha realmente** y **si se puede usar sin mouse**.

**Tiempo:** unos 25 minutos (10 de teclado + 15 de VoiceOver).
**Qué necesitás:** una Mac, la app corriendo (local o el deploy de prueba) y, si hay acceso por código, un código válido. No hace falta saber usar VoiceOver: los pasos están explicados.

> No uses el mouse ni el trackpad durante la prueba. Si en algún momento no podés avanzar sin tocarlo, **eso ya es un hallazgo**: anotalo.

---

## 0. Preparación (2 minutos)

1. **Navegador:** usá **Safari** para VoiceOver (es con el que mejor se lleva). Para la parte de teclado también sirve Chrome.
2. **Safari y la tecla Tab.** Por defecto, en Safari la tecla Tab solo salta entre campos y botones de formulario, y se saltea los links. Para que Tab recorra todo:
   Safari → Ajustes → Avanzado → activá **"Presionar Tab para resaltar cada elemento de una página web"**.
3. **Abrí la app** en una ventana nueva y cerrá el resto.
4. Si querés repetir la prueba desde cero, borrá el progreso guardado: tocá "Empezar de nuevo" en el informe, o limpiá los datos del sitio.

---

## Parte A — Solo teclado (sin VoiceOver) · 10 minutos

Teclas que vas a usar: **Tab** (siguiente), **Shift+Tab** (anterior), **Enter** (activar botones y links), **Espacio** (activar botones, marcar casillas), **Esc**.

| # | Qué hacer | Qué debería pasar | ✅ / ❌ | Qué viste |
|---|---|---|---|---|
| A1 | Cargá la página y apretá Tab una vez. | Aparece un **contorno visible** (naranja) sobre el primer elemento. En todo momento sabés dónde estás. | | |
| A2 | Si aparece la pantalla de código: escribí el código y Enter. | El campo ya tiene el foco al cargar. Un código incorrecto muestra el error sin que pierdas el campo. | | |
| A3 | En la landing, llegá con Tab hasta **"Empezar por acá" del Camino A** y apretá Enter. | Entrás al chat. El orden de Tab sigue el orden visual (izquierda a derecha, arriba a abajo). | | |
| A4 | En el chat, escribí un mensaje y enviá con **Enter**. | Se envía. **Shift+Enter** hace un salto de línea sin enviar. | | |
| A5 | Con Tab, recorré todo el chat. Fijate si podés llegar a "Sumar mi CV", "Sumar mi LinkedIn" y "¿Cómo bajo mi perfil de LinkedIn?". | Llegás a todos. El desplegable de LinkedIn se abre con **Enter o Espacio**. | | |
| A6 | Tocá "← Inicio" y entrá al **Camino B**. Con Tab recorré el formulario. | Pasás por: puesto → "PDF" → "Pegar texto" → **zona de carga del CV** → "PDF" → "Pegar texto" → **zona de carga de LinkedIn**. | | |
| A7 | Parate en la zona de carga del CV y apretá **Enter**. | Se abre el selector de archivos. Elegí un PDF con las flechas y Enter. Aparece el nombre del archivo. | | |
| A8 | Parate en "Pegar texto" (LinkedIn) y apretá **Espacio**. | Aparece un cuadro de texto y el foco no se pierde. | | |
| A9 | Pegá un texto de más de 80 caracteres en los dos cuadros. Llegá con Tab al botón "Ver cómo me lee un reclutador" y Enter. | Al terminar, el foco queda en el título **"Cómo te lee un reclutador"**, no al principio de la página ni en ningún lado raro. | | |
| A10 | En la lectura, con Tab, **marcá una recomendación con Espacio** y seguí hasta "Empezar la conversación". | Podés marcar y desmarcar. Al entrar al chat, el foco queda en el encabezado de la conversación. | | |
| A11 | (Opcional, si llegás al informe) Marcá un compromiso con Espacio y tocá "Asumir compromisos". | Se guarda y podés seguir con Tab hasta "Imprimir / guardar PDF". | | |
| A12 | En cualquier pantalla, **¿quedó algo que no pudiste alcanzar o activar?** | Nada. | | |

---

## Parte B — VoiceOver · 15 minutos

### Cómo se usa (lo mínimo)

- **Activar / desactivar:** `Cmd + F5`. La primera vez te ofrece un tutorial: podés saltearlo con Esc.
- **La "tecla VO"** es `Control + Opción`. En esta guía, **VO + →** significa mantener Control y Opción y apretar la flecha derecha.
- **Moverte por el contenido:** `VO + →` (siguiente) y `VO + ←` (anterior). Lee lo que va encontrando.
- **Activar un botón o link:** `VO + Espacio`.
- **Saltar entre controles:** `Tab`, como en la parte A.
- **Leer todo desde acá:** `VO + A`. **Callar la voz:** `Control`.
- **El rotor (muy útil):** `VO + U` abre un menú. Con `←` y `→` elegís qué mirar (**Encabezados**, **Links**, **Controles de formulario**, **Puntos de referencia**) y con `↑` y `↓` saltás entre ellos. `Esc` lo cierra.
- Si te perdés: `Cmd + F5` apaga todo y volvés a empezar.

> Mientras escuchás, **anotá textualmente lo que dice VoiceOver** cuando algo te suene raro, confuso o incompleto. Eso vale más que cualquier opinión.

### Escenarios

| # | Qué hacer | Qué debería escucharse | ✅ / ❌ | Qué escuchaste |
|---|---|---|---|---|
| B1 | Activá VoiceOver y cargá la página. Abrí el rotor (`VO+U`) → **Encabezados**. | Hay un solo encabezado principal (nivel 1) y los demás están ordenados (nivel 2 debajo del 1). | | |
| B2 | Rotor → **Puntos de referencia**. | Aparecen "principal" y "contenido info" (el pie). Podés saltar directo al contenido principal. | | |
| B3 | Recorré las dos tarjetas de la landing con `VO + →`. | Cada una se lee como título + descripción + botón **"Empezar por acá"**. *(Anotá si dos botones con el mismo texto te confunden: ¿sabés cuál es cuál?)* | | |
| B4 | Entrá al **Camino A**. | Al entrar anuncia **"Conversación con el coach: Diagnóstico, encabezado nivel 1"** (el foco va ahí). | | |
| B5 | Seguí con `VO + →`. | Lee la tarjeta "Antes de empezar, cómo funciona" y después el primer mensaje del coach. | | |
| B6 | Escribí un mensaje y enviá. **Sin tocar nada más, esperá.** | Anuncia algo como "El coach está escribiendo" y, cuando llega, **lee la respuesta sola**. *(Si tenés que ir a buscar la respuesta, es un problema serio: anotalo.)* | | |
| B7 | Recorré el panel de la derecha ("Progreso de la etapa"). | Lee cada objetivo con su estado: "Objetivo: cubierto", "Caminos: **pendiente**". *(Si solo dice "Caminos" sin estado, es un problema.)* | | |
| B8 | Mirá la barra de etapas de arriba (en pantalla ancha). | Anuncia "Diagnóstico, **paso actual**" y las demás con su número. | | |
| B9 | Provocá un error: apagá el wifi y mandá un mensaje. | Anuncia el error **de inmediato** (sin que lo busques) y ofrece "Reintentar". | | |
| B10 | Volvé a Inicio y entrá al **Camino B**. Con `Tab`, parate en cada control. | Cada control dice **qué es y su estado**: "PDF, botón, **presionado**" / "Pegar texto, botón, **no presionado**". La zona de carga dice **"Tu CV: elegir un archivo PDF, botón"**. | | |
| B11 | Abrí "¿Cómo bajo mi perfil de LinkedIn en PDF?". | Anuncia "expandido" y podés leer los 4 pasos como lista numerada. | | |
| B12 | Subí un PDF o pegá texto y generá la lectura. | Mientras espera anuncia "Leyendo tu perfil…". Al terminar, el foco va al título y lee la nota **junto con la aclaración** ("mide qué tan bien tu perfil comunica…, no cuánto valés"). | | |
| B13 | Recorré las recomendaciones. | Cada una se lee como casilla con su texto: "Actualizar el titular…, casilla, no marcada". Al marcarla dice "marcada". | | |
| B14 | (Si llegás) En el informe, recorré las acciones. | Lee el texto de cada acción y a qué bloque pertenece (70 / 20 / 10), si es "Pedido" u "Oferta". | | |
| B15 | **Impresión general:** ¿pudiste hacer todo el recorrido sin ayuda y sin sentirte perdido/a? | Sí. | | |

---

## Cómo reportar lo que encuentres

Para cada ❌, mandame **tres cosas** (o pegalas en la tabla de arriba):

1. **En qué paso** estabas (por ejemplo, "B7, panel de progreso").
2. **Qué escuchaste o qué pasó** (textual, si podés).
3. **Qué esperabas** que pasara.

Con eso lo puedo corregir sin tener que adivinar. Las correcciones suelen ser de minutos.

## Qué sigue después

- Corregir lo que aparezca y repetir solo esos pasos.
- Repetir la parte de teclado en **Chrome y Firefox**, y la de VoiceOver en el **iPhone** (Ajustes → Accesibilidad → VoiceOver), porque la experiencia en móvil es otra.
- Probar con **zoom al 200 %** (Cmd + "+" varias veces): nada debería quedar cortado ni superpuesto.
- Idealmente, que una **persona usuaria habitual de lector de pantalla** pruebe el flujo: encuentra cosas que nosotros no vemos.
