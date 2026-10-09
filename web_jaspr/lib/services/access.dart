import 'dart:convert';
import 'dart:js_interop';

import 'package:universal_web/web.dart' as web;

import 'http.dart' show apiBase;
import 'storage.dart';

// Código de acceso de prueba (ver server/access.ts). Se guarda en el navegador para no pedirlo en
// cada visita y se manda como header en cada pedido a /api.

const _key = 'cp_access';
const _labelKey = 'cp_access_label';

/// Se dispara cuando el servidor rechaza el código guardado (revocado o inválido).
const accessLostEvent = 'cp:access-lost';

String? getAccessCode() => readLocal(_key);
String? getAccessLabel() => readLocal(_labelKey);

void saveAccessCode(String code, [String? label]) {
  writeLocal(_key, code);
  if (label != null && label.isNotEmpty) writeLocal(_labelKey, label);
}

void clearAccessCode() {
  removeLocal(_key);
  removeLocal(_labelKey);
}

class AccessStatus {
  const AccessStatus({required this.required, required this.ok, this.label, this.error});

  /// El servidor exige código (en local, sin ACCESS_CODES, no).
  final bool required;
  final bool ok;

  /// Apodo de quien presentó un código válido (para saludarle en el menú).
  final String? label;
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
  if (res.ok) return AccessStatus(required: json['required'] == true, ok: json['ok'] == true, label: json['label'] as String?);
  // 401 (código inválido), 429 (demasiados intentos) o 503 (sin configurar).
  return AccessStatus(required: true, ok: false, error: (json['error'] as String?) ?? 'No pudimos verificar el código. Intentá de nuevo.');
}
