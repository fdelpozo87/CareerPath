import 'dart:convert';

import '../models/types.dart';
import 'storage.dart';

// Los procesos viven en el navegador de la persona (sin registro). Pueden ser varios y ninguno se
// borra al empezar otro. Misma clave y formato que la versión React.

const _key = 'cp_coach_sessions_v3';
const _legacyKey = 'cp_coach_session_v2';

/// Cuántos procesos se guardan como máximo en el navegador.
const maxSessions = 12;

List<Session> _readAll() {
  try {
    final raw = readLocal(_key);
    if (raw != null) {
      final items = (jsonDecode(raw) as Map<String, dynamic>)['items'] as List? ?? const [];
      return [for (final j in items) ?Session.fromJson(j as Map<String, dynamic>)];
    }
    // Migración: antes había un único proceso guardado. Pasa a ser el primero de la lista.
    final old = readLocal(_legacyKey);
    if (old != null) {
      final s = Session.fromJson(jsonDecode(old) as Map<String, dynamic>);
      if (s != null) {
        _writeAll([s]);
        removeLocal(_legacyKey);
        return [s];
      }
    }
  } catch (_) {
    // ignorado
  }
  return [];
}

void _writeAll(List<Session> items) => writeLocal(_key, jsonEncode({'items': [for (final s in items) s.toJson()]}));

int _byRecent(Session a, Session b) => b.updatedAt.compareTo(a.updatedAt);

/// Los procesos con algo guardado, el más reciente primero.
List<Session> listSessions() => _readAll().where((s) => s.hasProgress).toList()..sort(_byRecent);

void saveSession(Session s) {
  final all = _readAll();
  final exists = all.any((x) => x.id == s.id);
  // Un proceso existe desde que la persona escribe o carga su perfil, no desde que abre un camino.
  if (!exists && !s.hasProgress) return;
  final next = exists ? [for (final x in all) x.id == s.id ? s : x] : [s, ...all];
  next.sort(_byRecent);
  _writeAll(next.take(maxSessions).toList());
}

void deleteSession(String id) => _writeAll([for (final s in _readAll()) if (s.id != id) s]);

void clearAllSessions() {
  removeLocal(_key);
  removeLocal(_legacyKey);
}
