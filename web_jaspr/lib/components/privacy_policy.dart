import 'package:jaspr/jaspr.dart';

import '../ui.dart';
import 'logo.dart';

// Política de privacidad y términos de uso.
// BORRADOR: redactado a partir de lo que la app hace hoy con los datos. Antes de publicarlo debe
// revisarlo un/a abogado/a (Ley 25.326 de Protección de Datos Personales de Argentina y normativa
// de cada país donde se ofrezca). Los campos entre [corchetes] los completa el equipo.

const _updated = '30 de septiembre de 2026';

Component _strong(String text) => el('strong', 'text-foreground', [t(text)]);
Component _li(List<Component> children) => el('li', null, children);
Component _section(String title, List<Component> children) => el('section', null, [el('h2', null, [t(title)]), ...children]);

Component privacyPolicy({required void Function() onBack}) {
  return el('div', 'flex min-h-screen flex-col bg-background font-sans', [
    el('header', 'border-b border-border-color bg-background', [
      el('div', 'section-container flex items-center gap-4 py-4', [
        btn('text-sm text-text-muted transition-colors hover:text-foreground', [t('← Volver')], onClick: onBack),
        logo(),
      ]),
    ]),
    el('main', 'section-container max-w-3xl flex-1 py-12', [
      el('article', 'space-y-8 text-sm leading-relaxed text-foreground [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:text-text-muted [&_li]:text-text-muted', [
        el('header', null, [
          el('h1', 'mb-2 text-3xl', [t('Privacidad y términos de uso')]),
          el('p', 'text-xs', [t('Última actualización: $_updated')]),
        ]),
        _section('En pocas palabras', [
          el('ul', 'space-y-1', [
            _li([t('No necesitás cuenta ni registro. No te pedimos nombre, email ni teléfono.')]),
            _li([t('Lo que escribís y los documentos que subís se procesan para darte el servicio y no los guardamos en nuestros servidores.')]),
            _li([t('Tu progreso queda guardado solo en tu navegador, y podés borrarlo cuando quieras.')]),
            _li([t('Para generar las respuestas usamos un proveedor de inteligencia artificial (Google), que recibe el contenido de la conversación.')]),
            _li([t('CareerPath es una herramienta de reflexión: no reemplaza asesoramiento psicológico, médico ni legal.')]),
          ]),
        ]),
        _section('Quién es responsable', [
          el('p', null, [
            t('El servicio lo presta [razón social], CUIT [número], con domicilio en [domicilio] (“Rubika Networking”, “nosotros”). Para cualquier consulta sobre tus datos escribinos a [email de contacto de privacidad].'),
          ]),
        ]),
        _section('Qué datos se tratan y para qué', [
          el('ul', 'space-y-2', [
            _li([
              _strong('Lo que escribís en la conversación'),
              t(' y, si los subís, tu CV y/o tu perfil de LinkedIn exportado a PDF. Se usan solo para generar las preguntas, lecturas e informes de tu sesión. Te recomendamos no incluir datos sensibles (salud, afiliación sindical, religión, etc.) ni datos de terceros identificables.'),
            ]),
            _li([
              _strong('Datos técnicos'),
              t(': dirección IP y datos del navegador, que se usan para prevenir abusos (límite de consultas) y para el funcionamiento del servicio. En nuestros registros la IP se guarda transformada, no en claro, y nunca junto con el contenido de tu conversación.'),
            ]),
            _li([
              _strong('Métricas de uso anónimas'),
              t(' (por ejemplo, cuántas personas completan cada etapa), sin cookies y sin identificarte, para mejorar el producto.'),
            ]),
            _li([
              _strong('Reportes de errores'),
              t(', si están activados: información técnica del error, sin el contenido de tu conversación ni de tus documentos.'),
            ]),
          ]),
        ]),
        _section('Con quién se comparten', [
          el('p', null, [t('No vendemos ni cedemos tus datos. Para prestar el servicio trabajamos con estos proveedores:')]),
          el('ul', 'mt-2 space-y-1', [
            _li([
              _strong('Google (API de Gemini)'),
              t(': procesa el contenido de la conversación y los documentos para generar las respuestas, bajo sus términos para servicios pagos de la API. [Confirmar con el equipo legal las condiciones vigentes de retención y uso de datos del plan contratado.]'),
            ]),
            _li([_strong('Vercel'), t(': aloja el sitio y los servidores, y provee las métricas anónimas.')]),
            _li([_strong('Sentry'), t(' (si está activado): recibe reportes técnicos de errores.')]),
          ]),
          el('p', 'mt-2', [t('Algunos de estos proveedores procesan datos fuera de Argentina. [Detallar las garantías de transferencia internacional que correspondan.]')]),
        ]),
        _section('Dónde se guardan y por cuánto tiempo', [
          el('p', null, [
            t('Tu sesión (conversación, síntesis, informe y compromisos) se guarda en el almacenamiento local de tu navegador, no en nuestros servidores. Se borra cuando tocás “Empezar de nuevo” o cuando limpiás los datos del sitio en tu navegador. Si usás una computadora compartida, te recomendamos borrarla al terminar.'),
          ]),
        ]),
        _section('Tus derechos', [
          el('p', null, [
            t('Podés pedirnos acceso, rectificación, actualización o supresión de tus datos personales escribiendo a [email de contacto de privacidad]. Como no guardamos tu conversación en servidores, en general no tendremos datos tuyos asociados a tu identidad. La Agencia de Acceso a la Información Pública, en su carácter de Órgano de Control de la Ley N° 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.'),
          ]),
        ]),
        _section('Uso del servicio', [
          el('ul', 'space-y-1', [
            _li([t('CareerPath acompaña un proceso de reflexión sobre tu carrera. Las conclusiones y decisiones son tuyas: la herramienta no decide por vos ni evalúa tu valor como profesional.')]),
            _li([t('No es un servicio de salud mental, médico ni legal. Si atravesás una situación de maltrato, acoso o riesgo, buscá ayuda profesional; ante una emergencia, llamá al 911.')]),
            _li([t('Las respuestas las genera una inteligencia artificial y pueden contener errores.')]),
            _li([t('El servicio está dirigido a personas mayores de 18 años.')]),
            _li([t('No uses el servicio para cargar información de otras personas sin su consentimiento.')]),
          ]),
        ]),
        _section('Cambios', [
          el('p', null, [t('Si cambiamos esta política (por ejemplo, cuando sumemos cuentas de usuario), vamos a actualizar la fecha de arriba y, si el cambio es importante, avisarlo en el sitio.')]),
        ]),
      ]),
    ]),
  ]);
}
