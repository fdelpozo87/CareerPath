import 'dart:js_interop';

import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';
import 'package:universal_web/web.dart' as web;

import '../ui.dart';

// Menú de la persona: quién está con la sesión abierta y qué puede hacer con ella. Es un menú
// desplegable simple (botón + lista de botones): se cierra con Escape y al tocar afuera, y el foco
// vuelve al botón.

class AccountInfo {
  const AccountInfo({required this.label, required this.canLogout, required this.onLogout, required this.onDeleteData});

  /// Apodo asociado al código de acceso (ver server/access.ts); null si no se conoce.
  final String? label;

  /// Hay un código guardado, o sea, hay una sesión que cerrar.
  final bool canLogout;
  final void Function() onLogout;

  /// Borra la conversación guardada en este navegador.
  final void Function() onDeleteData;
}

const _item = 'block w-full rounded-xl px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-secondary';

class AccountMenu extends StatefulComponent {
  const AccountMenu({required this.account, super.key});
  final AccountInfo account;

  @override
  State<AccountMenu> createState() => _AccountMenuState();
}

class _AccountMenuState extends State<AccountMenu> {
  bool open = false;

  late final JSFunction _onDown = ((web.Event e) {
    if (!open) return;
    final wrap = web.document.getElementById('account-menu');
    if (wrap != null && !wrap.contains(e.target as web.Node?)) setState(() => open = false);
  }).toJS;

  late final JSFunction _onKey = ((web.Event e) {
    if (!open || (e as web.KeyboardEvent).key != 'Escape') return;
    setState(() => open = false);
    (web.document.getElementById('account-button') as web.HTMLElement?)?.focus();
  }).toJS;

  @override
  void initState() {
    super.initState();
    web.document.addEventListener('mousedown', _onDown);
    web.document.addEventListener('keydown', _onKey);
  }

  @override
  void dispose() {
    web.document.removeEventListener('mousedown', _onDown);
    web.document.removeEventListener('keydown', _onKey);
    super.dispose();
  }

  Component _personIcon() => el('svg', 'h-5 w-5', [
    el('circle', null, [], attrs: {'cx': '12', 'cy': '8', 'r': '3.6'}),
    el('path', null, [], attrs: {'d': 'M5 20c.8-3.6 3.6-5.4 7-5.4s6.2 1.8 7 5.4'}),
  ], attrs: {
    'viewBox': '0 0 24 24',
    'fill': 'none',
    'stroke': 'currentColor',
    'stroke-width': '1.8',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
  });

  @override
  Component build(BuildContext context) {
    final account = component.account;
    final label = account.label?.trim();
    final initial = (label != null && label.isNotEmpty) ? label[0].toUpperCase() : null;

    return el('div', 'relative', [
      el(
        'button',
        'flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary transition hover:bg-primary-soft/70',
        [initial != null ? t(initial) : _personIcon()],
        id: 'account-button',
        attrs: {
          'type': 'button',
          'aria-expanded': '$open',
          if (open) 'aria-controls': 'account-panel',
          'aria-label': label != null && label.isNotEmpty ? 'Mi cuenta ($label)' : 'Mi cuenta',
        },
        on: events(onClick: () => setState(() => open = !open)),
      ),
      when(open, () => el('div', 'card absolute right-0 top-full z-50 mt-2 w-64 p-2', [
        el('div', 'border-b border-border-color px-3 pb-3 pt-2', [
          el('p', 'text-xs font-semibold uppercase tracking-widest text-text-muted', [t('Sesión de prueba')]),
          el('p', 'mt-1 truncate text-sm font-medium text-foreground', [t(account.label ?? 'Sin identificar')]),
        ]),
        el('ul', 'mt-2 space-y-0.5', [
          el('li', null, [
            el('a', _item, [t('Privacidad y términos')], attrs: {'href': '#privacidad'}, on: events(onClick: () => setState(() => open = false))),
          ]),
          el('li', null, [
            btn(_item, [t('Borrar mi conversación')], onClick: () {
              setState(() => open = false);
              account.onDeleteData();
            }),
          ]),
          when(account.canLogout, () => el('li', null, [
            btn('$_item font-semibold', [t('Cerrar sesión')], onClick: () {
              setState(() => open = false);
              account.onLogout();
            }),
          ])),
        ]),
      ], id: 'account-panel')),
    ], id: 'account-menu');
  }
}
