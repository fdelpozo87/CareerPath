/// The entrypoint for the **client** app: se compila a JavaScript y corre en el navegador.
library;

import 'package:jaspr/client.dart';

import 'app.dart';
import 'services/monitoring.dart';

void main() {
  initMonitoring();
  runApp(App());
}
