#!/usr/bin/env node
// Genera las plantillas de los emails de acceso de Supabase (enlace de ingreso, invitación, confirmación, cambio de
// contraseña y de email, código de verificación) con el diseño de Bivio, en español con una versión corta en inglés.
//
//   node scripts/gen-email-templates.mjs
//
// Salida: supabase/email-templates/*.html y supabase/email-templates/README.md (con el asunto de cada una).
// Las plantillas se pegan a mano en el dashboard: Authentication → Emails → Templates. Supabase completa
// {{ .ConfirmationURL }}, {{ .Token }}, {{ .NewEmail }} y {{ .SiteURL }}.
// Usa shared/emailLayout.ts (Node 24 ejecuta TypeScript sin compilar).

import { mkdirSync, writeFileSync } from 'node:fs'
import { renderEmailHtml } from '../shared/emailLayout.ts'

const OUT = new URL('../supabase/email-templates/', import.meta.url)
mkdirSync(OUT, { recursive: true })

const URL_ = '{{ .ConfirmationURL }}'
const noteEs = 'Si el botón no funciona, copia y pega este enlace en tu navegador:'
const noteEn = 'If the button doesn’t work, copy and paste this link into your browser:'
const ignoreEs = 'Si no lo pediste, puedes ignorar este mensaje: nadie entra a tu cuenta sin este enlace.'
const ignoreEn = 'If you didn’t ask for this, you can ignore this message: nobody gets into your account without this link.'

const T = [
  {
    file: 'magic-link.html',
    template: 'Magic Link',
    subject: 'Tu enlace para entrar a Bivio',
    es: { heading: 'Tu enlace para entrar a Bivio', paragraphs: ['Toca el botón para entrar. El enlace vence en una hora y solo sirve una vez.'], cta: 'Entrar a Bivio', footer: ignoreEs },
    en: { heading: 'Your link to sign in to Bivio', paragraphs: ['Tap the button to sign in. The link expires in one hour and works only once.'], cta: 'Sign in to Bivio', footer: ignoreEn },
  },
  {
    file: 'invite.html',
    template: 'Invite user',
    subject: 'Te dieron acceso a Bivio',
    es: { heading: 'Te dieron acceso a Bivio', paragraphs: ['Quien administra Bivio te dio acceso. Toca el botón para entrar por primera vez; después podrás entrar con un enlace como este o elegir una contraseña.'], cta: 'Entrar a Bivio', footer: 'Si no esperabas este mensaje, puedes ignorarlo.' },
    en: { heading: 'You’ve been given access to Bivio', paragraphs: ['Whoever runs Bivio gave you access. Tap the button to sign in for the first time; afterwards you can sign in with a link like this one or choose a password.'], cta: 'Sign in to Bivio', footer: 'If you weren’t expecting this message, you can ignore it.' },
  },
  {
    file: 'confirmation.html',
    template: 'Confirm signup',
    subject: 'Confirma tu email en Bivio',
    es: { heading: 'Confirma tu email', paragraphs: ['Toca el botón para confirmar tu email y activar tu cuenta de Bivio.'], cta: 'Confirmar mi email', footer: 'Si no creaste una cuenta, puedes ignorar este mensaje.' },
    en: { heading: 'Confirm your email', paragraphs: ['Tap the button to confirm your email and activate your Bivio account.'], cta: 'Confirm my email', footer: 'If you didn’t create an account, you can ignore this message.' },
  },
  {
    file: 'recovery.html',
    template: 'Reset password',
    subject: 'Elige una contraseña nueva para Bivio',
    es: { heading: 'Elige una contraseña nueva', paragraphs: ['Pediste cambiar tu contraseña de Bivio. Toca el botón para elegir una nueva.'], cta: 'Elegir mi contraseña', footer: 'Si no lo pediste, puedes ignorar este mensaje: tu contraseña actual sigue funcionando.' },
    en: { heading: 'Choose a new password', paragraphs: ['You asked to change your Bivio password. Tap the button to choose a new one.'], cta: 'Choose my password', footer: 'If you didn’t ask for this, you can ignore this message: your current password still works.' },
  },
  {
    file: 'email-change.html',
    template: 'Change email address',
    subject: 'Confirma tu nuevo email en Bivio',
    es: { heading: 'Confirma tu nuevo email', paragraphs: ['Pediste cambiar tu email de Bivio a {{ .NewEmail }}. Toca el botón para confirmarlo.'], cta: 'Confirmar el cambio', footer: 'Si no lo pediste, puedes ignorar este mensaje.' },
    en: { heading: 'Confirm your new email', paragraphs: ['You asked to change your Bivio email to {{ .NewEmail }}. Tap the button to confirm it.'], cta: 'Confirm the change', footer: 'If you didn’t ask for this, you can ignore this message.' },
  },
]

const block = (c, note) => ({ heading: c.heading, paragraphs: c.paragraphs, cta: { label: c.cta, url: URL_ }, note: `${note} ${URL_}`, footer: c.footer })

const index = []
for (const t of T) {
  const html = renderEmailHtml([block(t.es, noteEs), block(t.en, noteEn)], '{{ .SiteURL }}')
  writeFileSync(new URL(t.file, OUT), html)
  index.push(`| ${t.template} | \`${t.file}\` | ${t.subject} |`)
}

// Código de verificación (reautenticación): no lleva botón, lleva el código.
const reauth = renderEmailHtml(
  [
    { heading: 'Tu código de verificación', paragraphs: ['Escribe este código en Bivio para confirmar que eres tú:', '{{ .Token }}'], footer: 'Si no lo pediste, puedes ignorar este mensaje.' },
    { heading: 'Your verification code', paragraphs: ['Enter this code in Bivio to confirm it’s you:', '{{ .Token }}'], footer: 'If you didn’t ask for this, you can ignore this message.' },
  ],
  '{{ .SiteURL }}',
)
writeFileSync(new URL('reauthentication.html', OUT), reauth)
index.push('| Reauthentication | `reauthentication.html` | Tu código de verificación de Bivio |')

writeFileSync(
  new URL('README.md', OUT),
  `# Plantillas de los emails de acceso

Generadas con \`node scripts/gen-email-templates.mjs\` (no se editan a mano: se cambia \`shared/emailLayout.ts\` o el script).

Para usarlas: Supabase → **Authentication → Emails → Templates**. Elige cada plantilla, pega el contenido del archivo en el
cuadro **Message body** (modo código fuente) y el asunto de la tabla en **Subject heading**. Guarda.

| Plantilla de Supabase | Archivo | Asunto |
|---|---|---|
${index.join('\n')}

El logo se carga desde \`{{ .SiteURL }}/email/logo.png\`: tiene que estar configurado el **Site URL** (Authentication → URL
Configuration) y desplegado el archivo \`public/email/logo.png\`.
`,
)
console.log(`Listo: ${T.length + 1} plantillas en supabase/email-templates/`)
