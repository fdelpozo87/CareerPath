import 'dart:js_interop';

import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';
import 'package:universal_web/web.dart' as web;

import '../i18n/i18n.dart';
import '../services/theme.dart';
import '../ui.dart';

// Botón de sol/luna para pasar de modo claro a oscuro. Muestra la acción que va a hacer: la luna
// en modo claro (para oscurecer) y el sol en modo oscuro (para aclarar).

class ThemeToggle extends StatefulComponent {
  const ThemeToggle({super.key});

  @override
  State<ThemeToggle> createState() => _ThemeToggleState();
}

class _ThemeToggleState extends State<ThemeToggle> {
  late String theme = resolveTheme(getThemeMode());

  // Se actualiza también cuando el tema cambia por otro lado (el sistema, otra parte de la app).
  late final JSFunction _onTheme = ((web.Event _) {
    if (mounted) setState(() => theme = resolveTheme(getThemeMode()));
  }).toJS;

  @override
  void initState() {
    super.initState();
    web.window.addEventListener(themeEvent, _onTheme);
  }

  @override
  void dispose() {
    web.window.removeEventListener(themeEvent, _onTheme);
    super.dispose();
  }

  Component _icon(List<Component> shapes) => el('svg', 'h-5 w-5', shapes, attrs: {
    'viewBox': '0 0 24 24',
    'fill': 'none',
    'stroke': 'currentColor',
    'stroke-width': '1.8',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
  });

  Component _path(String d) => el('path', null, [], attrs: {'d': d});

  @override
  Component build(BuildContext context) {
    final dark = theme == 'dark';
    final label = dark ? tl('theme.toLight') : tl('theme.toDark');
    return el(
      'button',
      'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border-color bg-card text-foreground transition-colors hover:bg-secondary',
      [
        dark
            ? _icon([
                el('circle', null, [], attrs: {'cx': '12', 'cy': '12', 'r': '4'}),
                _path('M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6'),
              ])
            : _icon([_path('M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z')]),
      ],
      attrs: {'type': 'button', 'aria-label': label, 'title': label},
      on: events(onClick: () => setThemeMode(dark ? ThemeMode.light : ThemeMode.dark)),
    );
  }
}
