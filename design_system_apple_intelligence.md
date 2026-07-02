# 🎨 AI-Driven Design System: Principios e Interacciones Inteligentes

Este documento establece las directrices de UI, UX y metodología de diseño para interfaces potenciadas por Inteligencia Artificial, basadas en el enfoque contextual, integrado y deferente de **Apple Intelligence**.

---

## 1. Principios Fundamentales de Diseño (UX Philosophy)

### A. UI Deferente (Deference)
La interfaz de usuario debe pasar a un segundo plano para que el contenido sea el protagonista. La IA no debe imponerse; actúa de forma silenciosa e invisible hasta que el usuario requiera su asistencia. 
* **Regla de oro:** No agregues cajas de chat masivas si una pequeña pastilla de contexto o una automatización en un botón resuelven el problema de forma integrada.

### B. Conciencia de Pantalla y Contexto Personal (On-Screen Awareness)
El sistema debe entender qué está haciendo, viendo o editando el usuario en el momento exacto de la interacción. La IA utiliza el contexto histórico y actual de la sesión para evitar que el usuario tenga que ingresar prompts repetitivos o contextuales.

### C. Continuidad sin Bloqueos (Fluidity)
Las acciones de IA no deben romper el flujo de trabajo del usuario. Las animaciones y tiempos de espera deben coexistir con la interfaz actual mediante transiciones fluidas y estados intermedios no disruptivos.

---

## 2. Los 3 Estados de Interacción de la IA

Para estandarizar el comportamiento visual, cualquier componente o contenedor asistido por la IA debe ciclar estrictamente por estos tres estados:

### 🟩 Estado 1: Pre-AI (Estado Base)
Es la interfaz limpia estándar del sistema. Los elementos con capacidades de IA ocultan su potencia detrás de iconos sutiles o micro-interacciones (ej. un botón de "Resumir" que solo aparece al pasar el cursor o hacer foco en un bloque denso de texto).

### 🟨 Estado 2: AI-Active (Procesando / Pensando)
Cuando la IA es invocada y procesa la información, el sistema debe dar un feedback visual continuo pero no invasivo.
* **Patrón Visual recomendando (The Shimmer Glow):** Un resplandor orgánico multicolor con degradados suaves (tonos lavanda, índigo y cian con baja saturación y opacidad del 20-30%) que se desplaza perimetralmente por los bordes internos del componente o del marco del dispositivo.
* **Bloqueo:** El resto de la pantalla permanece interactiva si el proceso es asíncrono. No se utilizan spinners de carga pesados.

### 🟦 Estado 3: AI-Resolved (Resultado del Output)
Una vez que la IA entrega el resultado, este se inyecta en la UI con una transición de opacidad y desplazamiento sutil hacia arriba (fade-in & slide-up de 150ms).
* **Tratamiento de Fondo:** El texto o contenedor generado por IA se posa sobre un fondo sutilmente tintado (un "tint" del color de acento con opacidad del 4% al 8%) o un borde difuminado para denotar que ese contenido fue *asistido* por la máquina y diferenciarlo del contenido cargado nativamente por el usuario.

---

## 3. Guía de Estilos y Tokens Visuales

Para mantener una estética de **"Light Tech"** y minimalismo profesional, aplicamos los siguientes tokens específicos para componentes de Inteligencia Artificial:

### Paleta de Colores Inteligentes (Muted Neon)
* `color-ai-glow-start`: `#E0D7FF` (Lavanda desaturado)
* `color-ai-glow-mid`: `#D2E7FF` (Cian suave)
* `color-ai-glow-end`: `#FFF0E5` (Champagne / Terracota muy claro)
* `color-ai-bg-tint`: `rgba(210, 231, 255, 0.06)` (Fondo de asistencia de IA)

### Tipografía y Jerarquía
* **Fuente Principal:** Tipografías Sans-serif limpias con excelente legibilidad en pantallas de alta densidad (ej. San Francisco, Inter, o IBM Plex Sans).
* **Monoespacio para Datos:** Para la visualización de métricas, código generado o variables, usar fuentes de ancho fijo ultra limpias como **IBM Plex Mono**, reduciendo el tamaño en 1pt respecto al texto base y utilizando un peso `regular` o `light`.

### Bordes y Sombras
* **Border Radius:** Componentes de IA deben usar esquinas significativamente redondeadas (`12px` a `16px` en tarjetas) para generar una percepción orgánica y amigable.
* **Sombras de Contexto:** `box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.05);` combinada con un microborde de `1px solid rgba(0, 0, 0, 0.03)` para dar profundidad en modos claros.

---

## 4. Patrones de UI Comunes (AI Design Patterns)

### 1. El Botón de Acción Contextual (Inline Smart Action)
Ubicado en la parte superior o flotando sutilmente al lado de bloques de contenido. Ofrece acciones directas de un solo clic: "Resumir", "Cambiar Tono", o "Extraer Datos Clave".

### 2. La Tarjeta de Notificación Condensada (Smart Summary Card)
En lugar de mostrar un historial largo, condensa la información en una tarjeta colapsable con viñetas concisas. Usa el `color-ai-bg-tint` como fondo para indicar procedencia automatizada.

### 3. El Input de Entrada Flotante Inteligente
Un campo de texto minimalista que no requiere botones de envío tradicionales; procesa mediante atajos de teclado (`Cmd + Enter`) y muestra el estado *AI-Active* directamente en su microborde perimetral mientras el usuario sigue navegando la pantalla principal.
