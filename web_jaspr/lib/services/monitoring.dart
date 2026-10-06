import 'package:universal_web/web.dart' as web;
import 'dart:js_interop';

import 'tracking.dart';

// Monitoreo de errores del cliente. Privacidad: nunca se envía el contenido de la conversación ni
// de los documentos; solo metadatos (dónde ocurrió y el tipo de error).

void reportError(Object? error, String where) {
  trackEvent('client_error', {'where': where, 'name': error == null ? 'null' : error.runtimeType.toString()});
}

void initMonitoring() {
  web.window.addEventListener('error', ((web.Event e) => reportError(e, 'window.error')).toJS);
  web.window.addEventListener('unhandledrejection', ((web.Event e) => reportError(e, 'unhandledrejection')).toJS);
}
