import 'dart:convert';
import 'dart:js_interop';

import 'package:universal_web/web.dart' as web;

import 'http.dart' show apiBase;
import 'storage.dart';

// Código de acceso de prueba (ver server/access.ts). Se guarda en el navegador para no pedirlo en
// cada visita y se manda como header en cada pedido a /api.

const _key = 'cp_access';

/// Se dispara cuando el servidor rechaza el código guardado (revocado o inválido).
const accessLostEvent = 'cp:access-lost';

String? getAccessCode() => readLocal(_key);
void saveAccessCode(String code) => writeLocal(_key, code);
void clearAccessCode() => removeLocal(_key);

class AccessStatus {
  const AccessStatus({required this.required, required this.ok, this.error});

  /// El servidor exige código (en local, sin ACCESS_CODES, no).
  final bool required;
  final bool ok;
  final String? error;
}

Future<AccessStatus> checkAccess([String? code]) async {
  final headers = web.Headers()..append('Content-Type', 'application/json');
  final res = await web.window
      .fetch(
        '$apiBase/api/access'.toJS,
        web.RequestInit(method: 'POST', headers: headers, body: jsonEncode(code == null ? {} : {'code': code}).toJS),
      )
      .toDart;
  Map<String, dynamic> json = {};
  try {
    final d = jsonDecode((await res.text().toDart).toDart);
    if (d is Map<String, dynamic>) json = d;
  } catch (_) {}
  if (res.ok) return AccessStatus(required: json['required'] == true, ok: json['ok'] == true);
  // 401 (código inválido), 429 (demasiados intentos) o 503 (sin configurar).
  return AccessStatus(required: true, ok: false, error: (json['error'] as String?) ?? 'No pudimos verificar el código. Intentá de nuevo.');
}
