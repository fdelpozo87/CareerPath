// Diseño de los emails de Bivio: la paleta de la marca (violeta, mandarina solo como relleno del botón, tinta y bruma)
// en un diseño de tablas con estilos en línea, que es lo único que renderizan de forma pareja los clientes de correo.
// Sin importaciones: lo usan el servidor (avisos, recordatorios) y el script que genera las plantillas de Supabase.

export interface EmailContent {
  /** Título grande del mensaje. */
  heading: string
  paragraphs: string[]
  /** Lista opcional (por ejemplo, los compromisos). */
  bullets?: string[]
  /** El botón principal: la acción de seguir (mandarina con texto tinta, como en la app). */
  cta?: { label: string; url: string }
  /** Línea chica antes del pie (por ejemplo, el vencimiento del enlace). */
  note?: string
  footer: string
  /** Texto que algunos clientes muestran junto al asunto. */
  preheader?: string
}

const C = {
  bg: '#faf9fc',
  card: '#ffffff',
  border: '#e3dcf3',
  ink: '#1f1533',
  muted: '#5e566d',
  violet: '#6a3fc1',
  soft: '#e9e2fa',
  accent: '#f28c38',
}
// Los clientes de correo no cargan tipografías de la web: títulos en una sans gruesa del sistema, parecida a la de la marca.
const DISPLAY = "'Plus Jakarta Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif"
const SANS = "-apple-system,'Segoe UI',Helvetica,Arial,sans-serif"

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function block(c: EmailContent, first: boolean): string {
  const size = first ? 24 : 18
  const body = first ? 16 : 14
  return `
<tr><td style="padding:${first ? '0' : '24px 0 0'}">
  ${first ? '' : `<div style="border-top:1px solid ${C.border};margin:0 0 20px"></div>`}
  <h1 style="margin:0 0 12px;font-family:${DISPLAY};font-size:${size}px;line-height:1.25;font-weight:700;letter-spacing:-0.01em;color:${C.ink}">${esc(c.heading)}</h1>
  ${c.paragraphs.map((p) => `<p style="margin:0 0 12px;font-family:${SANS};font-size:${body}px;line-height:1.6;color:${C.ink}">${esc(p)}</p>`).join('')}
  ${
    c.bullets?.length
      ? `<ul style="margin:0 0 12px;padding:0 0 0 20px;font-family:${SANS};font-size:${body}px;line-height:1.6;color:${C.ink}">${c.bullets.map((b) => `<li style="margin:0 0 6px">${esc(b)}</li>`).join('')}</ul>`
      : ''
  }
  ${
    c.cta
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 8px"><tr><td style="border-radius:999px;background:${C.accent}">
          <a href="${esc(c.cta.url)}" style="display:inline-block;padding:14px 30px;font-family:${SANS};font-size:16px;font-weight:700;color:${C.ink};text-decoration:none;border-radius:999px">${esc(c.cta.label)}</a>
        </td></tr></table>
        <p style="margin:0 0 4px;font-family:${SANS};font-size:12px;line-height:1.5;color:${C.muted}">${esc(c.note ?? '')}</p>`
      : c.note
        ? `<p style="margin:0 0 4px;font-family:${SANS};font-size:12px;line-height:1.5;color:${C.muted}">${esc(c.note)}</p>`
        : ''
  }
</td></tr>`
}

/**
 * HTML del mensaje. Con más de un bloque (por ejemplo, español e inglés) el primero lleva el botón grande y los
 * siguientes van debajo, separados y más chicos. `assetsUrl` es la dirección pública de la app (para el logo).
 */
export function renderEmailHtml(blocks: EmailContent[], assetsUrl: string): string {
  const first = blocks[0]
  const logo = `${assetsUrl.replace(/\/+$/, '')}/email/logo.png`
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only"><title>${esc(first.heading)}</title></head>
<body style="margin:0;padding:0;background:${C.bg}">
${first.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.bg}">${esc(first.preheader)}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg}"><tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
    <tr><td style="padding:0 4px 20px">
      <img src="${esc(logo)}" width="148" height="40" alt="Bivio" style="display:block;border:0;height:40px;width:148px">
    </td></tr>
    <tr><td style="background:${C.card};border:1px solid ${C.border};border-radius:20px;padding:32px 28px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${blocks.map((b, i) => block(b, i === 0)).join('')}
      </table>
    </td></tr>
    <tr><td style="padding:20px 8px 0;font-family:${SANS};font-size:12px;line-height:1.6;color:${C.muted};text-align:center">${blocks.map((b) => esc(b.footer)).join('<br>')}</td></tr>
  </table>
</td></tr></table>
</body></html>`
}

/** La versión de solo texto (lectores sin HTML y filtros antispam la piden). */
export function renderEmailText(blocks: EmailContent[]): string {
  return blocks
    .map((c) =>
      [c.heading, '', ...c.paragraphs, ...(c.bullets?.length ? ['', ...c.bullets.map((b) => `- ${b}`)] : []), ...(c.cta ? ['', `${c.cta.label}: ${c.cta.url}`] : []), ...(c.note ? ['', c.note] : []), '', c.footer].join('\n'),
    )
    .join('\n\n—\n\n')
}
