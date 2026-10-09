import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';

import '../services/access.dart';
import '../ui.dart';
import 'logo.dart';

// Pantalla de acceso de prueba: mientras Bivio se prueba fuera de local, solo entra quien
// tiene un código de invitación. El código lo valida el servidor en cada pedido a la API; esta
// pantalla es solo la puerta visible.

class AccessGate extends StatefulComponent {
  const AccessGate({this.initialError, required this.onGranted, super.key});

  /// Mensaje inicial, por ejemplo cuando el servidor no tiene el acceso configurado.
  final String? initialError;
  final void Function(String? label) onGranted;

  @override
  State<AccessGate> createState() => _AccessGateState();
}

class _AccessGateState extends State<AccessGate> {
  String code = '';
  String? error;
  bool busy = false;

  @override
  void initState() {
    super.initState();
    error = component.initialError;
  }

  Future<void> _submit() async {
    final value = code.trim();
    if (value.isEmpty || busy) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final status = await checkAccess(value);
      if (status.ok) {
        saveAccessCode(value, status.label);
        component.onGranted(status.label);
        return;
      }
      setState(() => error = status.error ?? 'Ese código no es válido.');
    } catch (_) {
      setState(() => error = 'No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Component build(BuildContext context) {
    return el('div', 'flex min-h-screen flex-col bg-background font-sans', [
      el('header', 'border-b border-border-color', [
        el('div', 'section-container py-4', [logo()]),
      ]),
      el('main', 'flex flex-1 items-center justify-center px-4 py-12', [
        el('div', 'card w-full max-w-md', [
          el('h1', 'mb-3 text-2xl md:text-3xl', [t('Bivio está en pruebas privadas')]),
          el('p', 'mb-6 text-sm leading-relaxed text-text-muted', [
            t('Ingresá el código de acceso que te enviamos. Lo usamos para cuidar el costo del servicio mientras lo probamos con un grupo reducido de personas.'),
          ]),
          el('form', null, [
            el('label', 'mb-2 block text-sm font-semibold text-foreground', [t('Código de acceso')], attrs: {'for': 'codigo'}),
            el('input', 'w-full rounded-xl border border-border-color p-3 font-mono text-sm tracking-wider outline-none focus:border-primary', [],
              id: 'codigo',
              attrs: {
                'type': 'text',
                'autofocus': '',
                'autocomplete': 'off',
                'autocapitalize': 'characters',
                'spellcheck': 'false',
                'maxlength': '40',
                'placeholder': 'XXXX-XXXX-XXXX',
                if (error != null) ...{'aria-invalid': 'true', 'aria-describedby': 'codigo-error'},
              },
              on: events<String>(onInput: (v) => setState(() => code = v)),
            ),
            el('div', 'min-h-6 pt-2 text-sm text-danger', [t(error ?? '')], id: 'codigo-error', attrs: {'role': 'alert'}),
            el('button', 'btn-primary mt-2 w-full py-3 disabled:cursor-not-allowed disabled:opacity-40', [t(busy ? 'Verificando…' : 'Entrar')],
              attrs: {'type': 'submit', if (code.trim().isEmpty || busy) 'disabled': ''}),
          ], on: {
            'submit': (e) {
              e.preventDefault();
              _submit();
            },
          }, attrs: {'novalidate': ''}),
          el('p', 'mt-6 text-xs text-text-muted', [
            t('¿No tenés código? Pedíselo a quien te invitó. '),
            anchor('underline underline-offset-2', '#privacidad', [t('Privacidad y términos')]),
          ]),
        ]),
      ]),
    ]);
  }
}
