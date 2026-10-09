import 'dart:async';
import 'dart:convert';
import 'dart:js_interop';

import 'package:universal_web/web.dart' as web;

import 'access.dart';

// Cliente HTTP compartido para /api/*. La API key de Gemini vive solo en el servidor: acá nunca
// viajan prompts ni secretos, solo los datos del flujo.

const _timeout = Duration(seconds: 60);

/// Base de la API. Vacía en producción (mismo origen); en desarrollo se puede apuntar a otro host
/// con `--dart-define=API_BASE=http://localhost:5173`.
const apiBase = String.fromEnvironment('API_BASE');

class ApiException implements Exception {
  ApiException(this.message);
  final String message;
  @override
  String toString() => message;
}

Future<Map<String, dynamic>> postJson(String path, Object? payload, {bool withCode = true}) async {
  final controller = web.AbortController();
  final timer = Timer(_timeout, () => controller.abort());
  final web.Response res;
  try {
    final headers = web.Headers()..append('Content-Type', 'application/json');
    final code = getAccessCode();
    if (withCode && code != null) headers.append('x-access-code', code);
    res = await web.window
        .fetch(
          '$apiBase$path'.toJS,
          web.RequestInit(method: 'POST', headers: headers, body: jsonEncode(payload).toJS, signal: controller.signal),
        )
        .toDart;
  } catch (e) {
    if (controller.signal.aborted) throw ApiException('La respuesta está tardando demasiado. Intentá de nuevo.');
    throw ApiException(
      web.window.navigator.onLine
          ? 'No pudimos conectar con el servidor. Intentá de nuevo.'
          : 'Parece que no tenés conexión a internet.',
    );
  } finally {
    timer.cancel();
  }

  Map<String, dynamic> json = {};
  try {
    final decoded = jsonDecode((await res.text().toDart).toDart);
    if (decoded is Map<String, dynamic>) json = decoded;
  } catch (_) {
    // Cuerpo vacío o que no es JSON: se informa por el status.
  }

  if (res.status == 401) {
    // El código guardado ya no sirve (revocado): vuelve a la pantalla de acceso.
    clearAccessCode();
    web.window.dispatchEvent(web.Event(accessLostEvent));
  }
  if (!res.ok || json['error'] != null) {
    throw ApiException((json['error'] as String?) ?? 'Algo falló. Intentá de nuevo.');
  }
  return json;
}
