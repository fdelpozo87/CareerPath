import 'dart:convert';

import '../models/types.dart';
import 'storage.dart';

// La sesión vive en el navegador de la persona (sin registro). Permite retomar el proceso — y los
// compromisos elegidos — más adelante. Misma clave y formato que la versión React.

const _key = 'cp_coach_session_v2';

Session? loadSession() {
  try {
    final raw = readLocal(_key);
    if (raw == null) return null;
    return Session.fromJson(jsonDecode(raw) as Map<String, dynamic>);
  } catch (_) {
    return null;
  }
}

void saveSession(Session s) => writeLocal(_key, jsonEncode(s.toJson()));
void clearSession() => removeLocal(_key);
