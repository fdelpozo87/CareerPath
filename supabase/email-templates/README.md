# Plantillas de los emails de acceso

Generadas con `node scripts/gen-email-templates.mjs` (no se editan a mano: se cambia `shared/emailLayout.ts` o el script).

Para usarlas: Supabase → **Authentication → Emails → Templates**. Elige cada plantilla, pega el contenido del archivo en el
cuadro **Message body** (modo código fuente) y el asunto de la tabla en **Subject heading**. Guarda.

| Plantilla de Supabase | Archivo | Asunto |
|---|---|---|
| Magic Link | `magic-link.html` | Tu enlace para entrar a Bivio |
| Invite user | `invite.html` | Te dieron acceso a Bivio |
| Confirm signup | `confirmation.html` | Confirma tu email en Bivio |
| Reset password | `recovery.html` | Elige una contraseña nueva para Bivio |
| Change email address | `email-change.html` | Confirma tu nuevo email en Bivio |
| Reauthentication | `reauthentication.html` | Tu código de verificación de Bivio |

El logo se carga desde `{{ .SiteURL }}/email/logo.png`: tiene que estar configurado el **Site URL** (Authentication → URL
Configuration) y desplegado el archivo `public/email/logo.png`.
