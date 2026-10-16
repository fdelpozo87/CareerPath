import 'package:universal_web/web.dart' as web;

import '../services/storage.dart';
import 'strings.g.dart';

// Idioma de la interfaz: español (neutro latinoamericano) o inglés. Misma regla que src/lib/i18n.ts.
// Los componentes llaman a tr() al construirse; App se reconstruye cuando cambia el idioma.

enum Lang {
  es('es', 'ES'),
  en('en', 'EN');

  const Lang(this.code, this.label);
  final String code;
  final String label;
}

const langEvent = 'cp:lang';
const _key = 'cp_lang';

Lang _detect() {
  final saved = readLocal(_key);
  for (final l in Lang.values) {
    if (l.code == saved) return l;
  }
  return web.window.navigator.language.toLowerCase().startsWith('en') ? Lang.en : Lang.es;
}

Lang _current = _detect();
Lang get currentLang => _current;

String _fill(String text, Map<String, Object>? vars) =>
    vars == null ? text : text.replaceAllMapped(RegExp(r'\{(\w+)\}'), (m) => '${vars[m[1]] ?? m[0]}');

String tr(String key, [Map<String, Object>? vars]) =>
    _fill((_current == Lang.en ? stringsEn : stringsEs)[key] ?? key, vars);

/// Plural simple: busca `$base.one` (n == 1) o `$base.other`. Siempre expone {n}.
String trn(String base, int n, [Map<String, Object>? vars]) => tr('$base.${n == 1 ? 'one' : 'other'}', {'n': n, ...?vars});

/// Refleja el idioma en el documento (lector de pantalla, traductor del navegador, título).
void applyLang() {
  web.document.documentElement?.setAttribute('lang', _current.code);
  web.document.title = tr('meta.title');
  web.document.querySelector('meta[name="description"]')?.setAttribute('content', tr('meta.description'));
}

void setLang(Lang lang) {
  if (lang == _current) return;
  _current = lang;
  writeLocal(_key, lang.code);
  applyLang();
  web.window.dispatchEvent(web.Event(langEvent));
}
