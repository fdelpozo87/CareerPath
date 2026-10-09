import 'dart:js_interop';
import 'dart:js_interop_unsafe';

import 'package:universal_web/web.dart' as web;

import 'storage.dart';

// Analytics anónimo (sin registro): un id por sesión de navegador, no ligado a una identidad.
// Vercel Analytics expone window.va cuando carga /_vercel/insights/script.js (ver web/index.html).

const _sessionKey = 'cp_session_id';

String sessionId() {
  var id = readSessionStorage(_sessionKey);
  if (id == null) {
    id = web.window.crypto.randomUUID();
    writeSessionStorage(_sessionKey, id);
  }
  return id;
}

void trackEvent(String event, [Map<String, Object> props = const {}]) {
  try {
    final va = (web.window as JSObject).getProperty<JSAny?>('va'.toJS);
    if (va == null || va.isUndefinedOrNull) return;
    final data = {'sessionId': sessionId(), ...props}.jsify();
    (web.window as JSObject).callMethod<JSAny?>('va'.toJS, 'event'.toJS, {'name': event, 'data': data}.jsify());
  } catch (_) {
    // El analytics nunca debe romper la app.
  }
}
