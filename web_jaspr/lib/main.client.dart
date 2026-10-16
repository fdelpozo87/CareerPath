/// The entrypoint for the **client** app: se compila a JavaScript y corre en el navegador.
library;

import 'package:jaspr/client.dart';

import 'app.dart';
import 'i18n/i18n.dart';
import 'services/monitoring.dart';
import 'services/theme.dart';

void main() {
  applyLang();
  applyTheme();
  watchSystemTheme();
  initMonitoring();
  runApp(App());
}
