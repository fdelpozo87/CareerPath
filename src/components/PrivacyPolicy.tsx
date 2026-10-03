import Logo from './Logo'

// Política de privacidad y términos de uso.
// BORRADOR: redactado a partir de lo que la app hace hoy con los datos. Antes
// de publicarlo debe revisarlo un/a abogado/a (Ley 25.326 de Protección de
// Datos Personales de Argentina y normativa de cada país donde se ofrezca).
// Los campos entre [corchetes] los completa el equipo.

const UPDATED = '30 de septiembre de 2026'

export default function PrivacyPolicy({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex min-h-screen flex-col bg-background font-sans">
      <header className="border-b border-border-color bg-background">
        <div className="section-container flex items-center gap-4 py-4">
          <button onClick={onBack} className="text-sm text-text-muted transition-colors hover:text-foreground">
            ← Volver
          </button>
          <Logo />
        </div>
      </header>

      <main className="section-container max-w-3xl flex-1 py-12">
        <article className="space-y-8 text-sm leading-relaxed text-foreground [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:text-text-muted [&_li]:text-text-muted">
          <header>
            <h1 className="mb-2 text-3xl">Privacidad y términos de uso</h1>
            <p className="text-xs">Última actualización: {UPDATED}</p>
          </header>

          <section>
            <h2>En pocas palabras</h2>
            <ul className="space-y-1">
              <li>No necesitás cuenta ni registro. No te pedimos nombre, email ni teléfono.</li>
              <li>Lo que escribís y los documentos que subís se procesan para darte el servicio y no los guardamos en nuestros servidores.</li>
              <li>Tu progreso queda guardado solo en tu navegador, y podés borrarlo cuando quieras.</li>
              <li>Para generar las respuestas usamos un proveedor de inteligencia artificial (Google), que recibe el contenido de la conversación.</li>
              <li>CareerPath es una herramienta de reflexión: no reemplaza asesoramiento psicológico, médico ni legal.</li>
            </ul>
          </section>

          <section>
            <h2>Quién es responsable</h2>
            <p>
              El servicio lo presta [razón social], CUIT [número], con domicilio en [domicilio] (“Rubika Networking”, “nosotros”).
              Para cualquier consulta sobre tus datos escribinos a [email de contacto de privacidad].
            </p>
          </section>

          <section>
            <h2>Qué datos se tratan y para qué</h2>
            <ul className="space-y-2">
              <li>
                <strong className="text-foreground">Lo que escribís en la conversación</strong> y, si los subís, tu CV y/o tu perfil de
                LinkedIn exportado a PDF. Se usan solo para generar las preguntas, lecturas e informes de tu sesión. Te recomendamos no
                incluir datos sensibles (salud, afiliación sindical, religión, etc.) ni datos de terceros identificables.
              </li>
              <li>
                <strong className="text-foreground">Datos técnicos</strong>: dirección IP y datos del navegador, que se usan para
                prevenir abusos (límite de consultas) y para el funcionamiento del servicio. En nuestros registros la IP se guarda
                transformada, no en claro, y nunca junto con el contenido de tu conversación.
              </li>
              <li>
                <strong className="text-foreground">Métricas de uso anónimas</strong> (por ejemplo, cuántas personas completan cada
                etapa), sin cookies y sin identificarte, para mejorar el producto.
              </li>
              <li>
                <strong className="text-foreground">Reportes de errores</strong>, si están activados: información técnica del error,
                sin el contenido de tu conversación ni de tus documentos.
              </li>
            </ul>
          </section>

          <section>
            <h2>Con quién se comparten</h2>
            <p>No vendemos ni cedemos tus datos. Para prestar el servicio trabajamos con estos proveedores:</p>
            <ul className="mt-2 space-y-1">
              <li>
                <strong className="text-foreground">Google (API de Gemini)</strong>: procesa el contenido de la conversación y los
                documentos para generar las respuestas, bajo sus términos para servicios pagos de la API. [Confirmar con el equipo
                legal las condiciones vigentes de retención y uso de datos del plan contratado.]
              </li>
              <li>
                <strong className="text-foreground">Vercel</strong>: aloja el sitio y los servidores, y provee las métricas anónimas.
              </li>
              <li>
                <strong className="text-foreground">Sentry</strong> (si está activado): recibe reportes técnicos de errores.
              </li>
            </ul>
            <p className="mt-2">
              Algunos de estos proveedores procesan datos fuera de Argentina. [Detallar las garantías de transferencia internacional
              que correspondan.]
            </p>
          </section>

          <section>
            <h2>Dónde se guardan y por cuánto tiempo</h2>
            <p>
              Tu sesión (conversación, síntesis, informe y compromisos) se guarda en el almacenamiento local de tu navegador, no en
              nuestros servidores. Se borra cuando tocás “Empezar de nuevo” o cuando limpiás los datos del sitio en tu navegador. Si
              usás una computadora compartida, te recomendamos borrarla al terminar.
            </p>
          </section>

          <section>
            <h2>Tus derechos</h2>
            <p>
              Podés pedirnos acceso, rectificación, actualización o supresión de tus datos personales escribiendo a [email de
              contacto de privacidad]. Como no guardamos tu conversación en servidores, en general no tendremos datos tuyos asociados
              a tu identidad. La Agencia de Acceso a la Información Pública, en su carácter de Órgano de Control de la Ley N° 25.326,
              tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por
              incumplimiento de las normas vigentes en materia de protección de datos personales.
            </p>
          </section>

          <section>
            <h2>Uso del servicio</h2>
            <ul className="space-y-1">
              <li>
                CareerPath acompaña un proceso de reflexión sobre tu carrera. Las conclusiones y decisiones son tuyas: la herramienta
                no decide por vos ni evalúa tu valor como profesional.
              </li>
              <li>
                No es un servicio de salud mental, médico ni legal. Si atravesás una situación de maltrato, acoso o riesgo, buscá
                ayuda profesional; ante una emergencia, llamá al 911.
              </li>
              <li>Las respuestas las genera una inteligencia artificial y pueden contener errores.</li>
              <li>El servicio está dirigido a personas mayores de 18 años.</li>
              <li>No uses el servicio para cargar información de otras personas sin su consentimiento.</li>
            </ul>
          </section>

          <section>
            <h2>Cambios</h2>
            <p>
              Si cambiamos esta política (por ejemplo, cuando sumemos cuentas de usuario), vamos a actualizar la fecha de arriba y,
              si el cambio es importante, avisarlo en el sitio.
            </p>
          </section>
        </article>
      </main>
    </div>
  )
}
