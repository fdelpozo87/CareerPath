import 'dart:js_interop';

import 'package:universal_web/web.dart' as web;

import 'storage.dart';

// Apariencia del sitio: claro, oscuro o automático (el del sistema). Misma regla que
// src/lib/theme.ts y que el script de web/index.html (que corre antes del primer dibujado).

enum ThemeMode {
  light('light', 'Claro'),
  dark('dark', 'Oscuro'),
  auto('auto', 'Auto');

  const ThemeMode(this.id, this.label);
  final String id;
  final String label;
}

/// Se dispara cada vez que cambia el tema aplicado, para que los botones se actualicen.
const themeEvent = 'cp:theme';

const _key = 'cp_theme';
const _themeColor = {'light': '#781633', 'dark': '#170e12'};

ThemeMode getThemeMode() => switch (readLocal(_key)) {
  'light' => ThemeMode.light,
  'dark' => ThemeMode.dark,
  _ => ThemeMode.auto,
};

bool _systemPrefersDark() => web.window.matchMedia('(prefers-color-scheme: dark)').matches;

String resolveTheme(ThemeMode mode) => switch (mode) {
  ThemeMode.light => 'light',
  ThemeMode.dark => 'dark',
  ThemeMode.auto => _systemPrefersDark() ? 'dark' : 'light',
};

void applyTheme([ThemeMode? mode]) {
  final theme = resolveTheme(mode ?? getThemeMode());
  web.document.documentElement?.setAttribute('data-theme', theme);
  web.document.querySelector('meta[name="theme-color"]')?.setAttribute('content', _themeColor[theme]!);
  web.window.dispatchEvent(web.Event(themeEvent));
}

void setThemeMode(ThemeMode mode) {
  if (mode == ThemeMode.auto) {
    removeLocal(_key);
  } else {
    writeLocal(_key, mode.id);
  }
  applyTheme(mode);
}

/// En "automático", acompaña los cambios del sistema (por ejemplo, el modo nocturno del celular).
void watchSystemTheme() {
  web.window.matchMedia('(prefers-color-scheme: dark)').addEventListener(
    'change',
    ((web.Event _) {
      if (getThemeMode() == ThemeMode.auto) applyTheme(ThemeMode.auto);
    }).toJS,
  );
}
