import 'package:jaspr/jaspr.dart';

import '../i18n/i18n.dart';
import '../ui.dart';
import 'language_toggle.dart';
import 'logo.dart';
import 'theme_toggle.dart';

// Política de privacidad y términos de uso.
// BORRADOR: redactado a partir de lo que la app hace hoy con los datos. Antes de publicarlo debe
// revisarlo un/a abogado/a (Ley 25.326 de Protección de Datos Personales de Argentina y normativa
// de cada país donde se ofrezca). Los campos entre [corchetes] los completa el equipo.

String _p(String key) => tl('privacy.$key');

Component _strong(String text) => el('strong', 'text-foreground', [t(text)]);
Component _li(List<Component> children) => el('li', null, children);

/// Un ítem con parte en negrita: el texto va en dos claves (`base.strong` y `base.rest`).
Component _item(String base) => _li([_strong(_p('$base.strong')), t(_p('$base.rest'))]);

Component _section(String title, List<Component> children) => el('section', null, [el('h2', null, [t(title)]), ...children]);

Component privacyPolicy({required void Function() onBack}) {
  return el('div', 'flex min-h-screen flex-col bg-background font-sans', [
    el('header', 'border-b border-border-color bg-background', [
      el('div', 'section-container flex items-center gap-4 py-4', [
        btn('text-sm text-text-muted transition-colors hover:text-foreground', [t(tl('common.back'))], onClick: onBack),
        logo(),
        el('div', 'ml-auto flex items-center gap-2', [languageToggle(), const ThemeToggle()]),
      ]),
    ]),
    el('main', 'section-container max-w-3xl flex-1 py-12', [
      el('article', 'space-y-8 text-sm leading-relaxed text-foreground [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:text-text-muted [&_li]:text-text-muted', [
        el('header', null, [
          el('h1', 'mb-2 text-3xl', [t(_p('title'))]),
          el('p', 'text-xs', [t(tl('privacy.updated', {'date': _p('date')}))]),
          el('p', 'mt-2 rounded-xl border border-border-color bg-secondary p-3 text-xs', [t(_p('draft'))]),
        ]),
        _section(_p('s1.title'), [
          el('ul', 'space-y-1', [for (var n = 1; n <= 5; n++) _li([t(_p('s1.$n'))])]),
        ]),
        _section(_p('s2.title'), [el('p', null, [t(_p('s2.body'))])]),
        _section(_p('s3.title'), [
          el('ul', 'space-y-2', [for (final x in ['a', 'b', 'c', 'd', 'e']) _item('s3.$x')]),
        ]),
        _section(_p('s4.title'), [
          el('p', null, [t(_p('s4.intro'))]),
          el('ul', 'mt-2 space-y-1', [for (final x in ['g', 'v', 's', 'sb', 'r']) _item('s4.$x')]),
          el('p', 'mt-2', [t(_p('s4.outside'))]),
        ]),
        _section(_p('s5.title'), [el('p', null, [t(_p('s5.body'))])]),
        _section(_p('s6.title'), [el('p', null, [t(_p('s6.body'))])]),
        _section(_p('s7.title'), [
          el('ul', 'space-y-1', [for (var n = 1; n <= 5; n++) _li([t(_p('s7.$n'))])]),
        ]),
        _section(_p('s8.title'), [el('p', null, [t(_p('s8.body'))])]),
      ]),
    ]),
  ]);
}
