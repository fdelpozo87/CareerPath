// Compartido entre el servidor y la pantalla.

/**
 * ¿La persona pregunta por sueldos, costos o demanda? Red de seguridad: el modelo a veces contesta "no tengo
 * esos datos" en lugar de pedir la búsqueda; si el mensaje lo es a todas luces, se lo vuelve a pedir una vez.
 */
export function looksLikeMarketQuestion(text: string): boolean {
  return /(cu[aá]nto\s+(cuesta|sale|se\s+cobra|se\s+gana|gana|pagan|cobran)|sueldo|salario|honorarios|costo|precio|arancel|cuota|salida\s+laboral|demanda\s+laboral|how\s+much|salary|salaries|\bcost\b|tuition|job\s+market|in\s+demand)/i.test(text)
}
