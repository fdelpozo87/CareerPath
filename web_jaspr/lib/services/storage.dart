import 'package:universal_web/web.dart' as web;

// localStorage / sessionStorage con try/catch: en modo privado o con el sitio bloqueado pueden
// lanzar, y la app tiene que seguir funcionando en memoria.

String? readLocal(String key) {
  try {
    return web.window.localStorage.getItem(key);
  } catch (_) {
    return null;
  }
}

void writeLocal(String key, String value) {
  try {
    web.window.localStorage.setItem(key, value);
  } catch (_) {
    // Sin storage (modo privado, cuota): sigue en memoria.
  }
}

void removeLocal(String key) {
  try {
    web.window.localStorage.removeItem(key);
  } catch (_) {
    // ignorado
  }
}

String? readSessionStorage(String key) {
  try {
    return web.window.sessionStorage.getItem(key);
  } catch (_) {
    return null;
  }
}

void writeSessionStorage(String key, String value) {
  try {
    web.window.sessionStorage.setItem(key, value);
  } catch (_) {
    // ignorado
  }
}
