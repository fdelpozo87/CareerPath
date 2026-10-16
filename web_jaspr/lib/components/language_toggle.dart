import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';

import '../i18n/i18n.dart';
import '../ui.dart';

// Selector de idioma: dos botones (ES · EN) con el activo resaltado. Cada nombre de idioma se
// escribe en su propio idioma (para quien no entiende el actual) y lleva su atributo lang.

Component languageToggle() => el(
  'div',
  'flex h-10 shrink-0 items-center rounded-full border border-border-color bg-card p-1',
  [
    for (final l in Lang.values)
      el(
        'button',
        'h-8 min-w-9 rounded-full px-2 text-xs font-semibold transition-colors ${currentLang == l ? 'bg-primary text-on-primary' : 'text-text-muted hover:text-foreground'}',
        [t(l.label)],
        attrs: {'type': 'button', 'lang': l.code, 'aria-pressed': '${currentLang == l}', 'aria-label': tl('lang.${l.code}'), 'title': tl('lang.${l.code}')},
        on: events(onClick: () => setLang(l)),
      ),
  ],
  attrs: {'role': 'group', 'aria-label': tl('lang.label')},
);
