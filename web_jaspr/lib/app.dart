import 'dart:js_interop';

import 'package:jaspr/jaspr.dart';
import 'package:universal_web/web.dart' as web;

import 'components/access_gate.dart';
import 'components/chrome.dart';
import 'components/coach/coach_flow.dart';
import 'components/landing.dart';
import 'components/privacy_policy.dart';
import 'models/stages.dart';
import 'models/types.dart';
import 'services/access.dart';
import 'services/session_store.dart';
import 'services/tracking.dart';
import 'ui.dart';

enum _View { landing, coach, privacidad }

sealed class _Access {
  const _Access();
}

class _Checking extends _Access {
  const _Checking();
}

class _Locked extends _Access {
  const _Locked([this.error]);
  final String? error;
}

class _Open extends _Access {
  const _Open();
}

bool _isPrivacyHash() => web.window.location.hash == '#privacidad';

void _scrollTop() => web.window.scrollTo(web.ScrollToOptions(top: 0));

class App extends StatefulComponent {
  const App({super.key});

  @override
  State<App> createState() => _AppState();
}

class _AppState extends State<App> {
  _View view = _isPrivacyHash() ? _View.privacidad : _View.landing;
  Session? session;
  _Access access = const _Checking();
  late final JSFunction _onLost = ((web.Event _) {
    // Al perder el acceso se sale del chat: la sesión ya está guardada en el navegador y se retoma
    // desde "Retomar" al volver a entrar (evita remontar con una copia vieja).
    setState(() {
      access = const _Locked();
      view = _View.landing;
    });
  }).toJS;
  late final JSFunction _onHash = ((web.Event _) {
    if (_isPrivacyHash()) {
      trackEvent('privacy_viewed');
      setState(() => view = _View.privacidad);
      _scrollTop();
    }
  }).toJS;

  @override
  void initState() {
    super.initState();
    // Acceso de prueba: pregunta al servidor si hace falta código y si el guardado sirve. En local
    // (sin ACCESS_CODES) el servidor responde "no requerido" y no se muestra nada.
    checkAccess(getAccessCode()).then((s) {
      if (!mounted) return;
      setState(() => access = !s.required || s.ok ? const _Open() : _Locked(s.error));
    }).catchError((_) {
      // Sin conexión no se puede decidir; si el servidor exige código, cada pedido a la API lo valida igual.
      if (mounted) setState(() => access = const _Open());
    });
    web.window.addEventListener(accessLostEvent, _onLost);
    web.window.addEventListener('hashchange', _onHash);
  }

  @override
  void dispose() {
    web.window.removeEventListener(accessLostEvent, _onLost);
    web.window.removeEventListener('hashchange', _onHash);
    super.dispose();
  }

  void _startPath(CoachPath path, Session? saved) {
    if (saved != null && !web.window.confirm('Tenés un proceso en curso. ¿Querés empezar uno nuevo? El anterior se va a borrar.')) return;
    trackEvent('path_selected', {'path': path.id});
    clearSession();
    setState(() {
      session = Session.nueva(path);
      view = _View.coach;
    });
    _scrollTop();
  }

  @override
  Component build(BuildContext context) {
    if (view == _View.privacidad) {
      return privacyPolicy(onBack: () {
        web.window.history.replaceState(null, '', web.window.location.pathname);
        setState(() => view = _View.landing);
      });
    }

    final a = access;
    if (a is _Checking) {
      return el('div', 'flex min-h-screen items-center justify-center bg-background', [
        el('p', 'text-sm text-text-muted', [t('Cargando…')], attrs: {'role': 'status'}),
      ]);
    }
    if (a is _Locked) {
      return AccessGate(initialError: a.error, onGranted: () => setState(() => access = const _Open()));
    }

    if (view == _View.coach && session != null) {
      return CoachFlow(
        initialSession: session!,
        onExit: () => setState(() => view = _View.landing),
        onRestart: () {
          clearSession();
          setState(() {
            session = null;
            view = _View.landing;
          });
        },
      );
    }

    // Se relee al volver a la landing para reflejar el progreso guardado.
    final stored = loadSession();
    final saved = stored != null && stored.hasProgress ? stored : null;

    return el('div', 'flex min-h-screen flex-col bg-background font-sans', [
      siteHeader(),
      el('main', 'flex-1', [
        landing(
          onChoosePath: (p) => _startPath(p, saved),
          saved: saved,
          onResume: () {
            if (saved == null) return;
            trackEvent('session_resumed', {'phase': saved.phase.name, 'stage': saved.stage.id});
            setState(() {
              session = saved;
              view = _View.coach;
            });
            _scrollTop();
          },
        ),
      ]),
      siteFooter(),
    ]);
  }
}
