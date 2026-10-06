import 'dart:convert';

import 'package:jaspr/jaspr.dart';
import 'package:universal_web/web.dart' as web;

import '../../models/stages.dart';
import '../../models/types.dart';
import '../../services/coach_api.dart';
import '../../services/http.dart' show ApiException;
import '../../services/session_store.dart';
import '../../services/tracking.dart';
import '../../ui.dart';
import '../logo.dart';
import 'chat_view.dart';
import 'profile_step.dart';
import 'report_view.dart';

// Orquesta el proceso: (Camino B: lectura del perfil) → Diagnóstico → Discovery → Plan de Acción
// → informe con compromisos elegidos.

const _stageCompletedEvent = {
  Stage.diagnostico: 'diagnosis_completed',
  Stage.discovery: 'discovery_completed',
  Stage.plan: 'action_plan_completed',
};

// Mensajes de control: le indican al agente que abra una etapa. No se muestran.
String _openingInstruction(Session s) {
  if (s.stage == Stage.diagnostico) {
    return s.path == CoachPath.perfil
        ? '(Inicio de la sesión, Camino B. La persona acaba de ver la lectura externa de su perfil. Presentate en una oración — vas a preguntar más de lo que vas a responder y las conclusiones van a ser suyas — y preguntale qué le resonó y qué no de esa lectura. Indagá antes de sumar cualquier lectura propia.)'
        : '(Inicio de la sesión, Camino A. Presentate en una oración — vas a preguntar más de lo que vas a responder y las conclusiones van a ser suyas — y hacé tu primera pregunta abierta.)';
  }
  return '(La persona confirmó la síntesis de la etapa anterior y pasa a ${s.stage.label}. Hacé una transición de una oración apoyada en lo que dijo y tu primera pregunta de esta etapa.)';
}

/// Si la etapa actual todavía no arrancó, agrega el mensaje de control que la abre. Devuelve true si lo agregó.
bool _withOpening(Session s) {
  if (s.phase != Phase.chat || s.messages.any((m) => m.stage == s.stage)) return false;
  s.messages.add(UiMessage(role: 'user', text: _openingInstruction(s), hidden: true, stage: s.stage));
  return true;
}

void _applyTurn(Session s, Stage stage, TurnResult turn) {
  if (s.stage != stage) return;
  // ¿Este turno trae un mapa nuevo (o actualizado)? Solo entonces el mapa se ubica después de este mensaje.
  final entregaMapa = turn.listoParaAvanzar && (turn.sintesisItems.isNotEmpty || turn.sintesisEtapa.isNotEmpty);
  s.messages.add(UiMessage(
    role: 'model',
    text: turn.mensaje,
    raw: jsonEncode(_turnToJson(turn)),
    stage: stage,
    derivacion: turn.derivacion,
    cierraEtapa: entregaMapa,
  ));
  s.cubiertos[stage] = turn.objetivosCubiertos;
  // Una etapa cerrada no se reabre: lo que la persona escriba después (un "gracias", un ajuste) no
  // hace desaparecer el mapa ni el botón para seguir. Solo avanzar de etapa lo reinicia.
  s.stageReady = s.stageReady || turn.listoParaAvanzar;
  s.foco = turn.temaEnFoco.isEmpty ? null : turn.temaEnFoco;
  s.omitidos[stage] = turn.temasOmitidos;
  if (entregaMapa && turn.sintesisEtapa.isNotEmpty) s.sintesis[stage] = turn.sintesisEtapa;
  if (turn.listoParaAvanzar && turn.sintesisItems.isNotEmpty) {
    s.mapas[stage] = StageMap(items: turn.sintesisItems, pregunta: turn.preguntaPuente);
  }
  s.updatedAt = DateTime.now().toUtc().toIso8601String();
}

/// El historial que se reenvía al modelo es el JSON crudo del turno (misma forma que devuelve el servidor).
Map<String, dynamic> _turnToJson(TurnResult t) => {
  'mensaje': t.mensaje,
  'temaEnFoco': t.temaEnFoco,
  'temasOmitidos': t.temasOmitidos,
  'objetivosCubiertos': t.objetivosCubiertos,
  'listoParaAvanzar': t.listoParaAvanzar,
  'derivacion': t.derivacion,
  'sintesisEtapa': t.sintesisEtapa,
  'sintesisItems': [for (final i in t.sintesisItems) i.toJson()],
  'preguntaPuente': t.preguntaPuente,
};

class CoachFlow extends StatefulComponent {
  const CoachFlow({required this.initialSession, required this.onExit, required this.onRestart, super.key});
  final Session initialSession;
  final void Function() onExit;
  final void Function() onRestart;

  @override
  State<CoachFlow> createState() => _CoachFlowState();
}

class _CoachFlowState extends State<CoachFlow> {
  late Session session;
  bool thinking = false;
  String? error;
  bool demo = false;
  String? docStatus;
  bool inFlight = false;
  ({Phase phase, Stage stage})? _prevPlace;

  @override
  void initState() {
    super.initState();
    session = component.initialSession;
    final openingPending = _withOpening(session);
    // Si la sesión retomada quedó esperando al coach, se ofrece reintentar.
    if (session.phase == Phase.informe && session.informe == null) {
      error = 'El informe no llegó a generarse.';
    } else if (session.phase == Phase.chat && session.messages.isNotEmpty && session.messages.last.isUser && !openingPending) {
      error = 'La última respuesta del coach no llegó.';
    }
    saveSession(session);
    if (openingPending) {
      if (session.stage == Stage.diagnostico) trackEvent('diagnosis_started', {'path': session.path.id});
      Future.microtask(() => _runTurn());
    }
  }

  /// Aplica un cambio a la sesión, la guarda y vuelve a dibujar.
  void _update(void Function() change) {
    change();
    saveSession(session);
    if (mounted) setState(() {});
  }

  Future<void> _runTurn() async {
    if (inFlight) return;
    inFlight = true;
    final stage = session.stage;
    final path = session.path;
    final wasReady = session.stageReady;
    setState(() {
      thinking = true;
      error = null;
    });
    try {
      final r = await requestTurn(session);
      demo = r.demo;
      _update(() => _applyTurn(session, stage, r.data));
      if (r.data.derivacion) trackEvent('derivation_shown', {'stage': stage.id});
      if (r.data.listoParaAvanzar && !wasReady) {
        trackEvent('stage_completed', {'stage': stage.id, 'path': path.id});
        trackEvent(_stageCompletedEvent[stage]!, {'path': path.id});
      }
    } catch (e) {
      if (mounted) setState(() => error = e is ApiException ? e.message : 'Algo falló. Intentá de nuevo.');
    } finally {
      inFlight = false;
      if (mounted) setState(() => thinking = false);
    }
  }

  Future<void> _generateReport() async {
    if (inFlight) return;
    inFlight = true;
    setState(() => error = null);
    try {
      final report = await requestReport(session);
      _update(() {
        session.informe = report;
        session.updatedAt = DateTime.now().toUtc().toIso8601String();
      });
      trackEvent('report_generated', {'acciones': report.acciones.length});
    } catch (e) {
      if (mounted) setState(() => error = e is ApiException ? e.message : 'No pudimos armar el informe.');
    } finally {
      inFlight = false;
      if (mounted) setState(() {});
    }
  }

  void _startStage() {
    final opened = _withOpening(session);
    _update(() {});
    if (opened) _runTurn();
  }

  void _handleSend(String text) {
    _update(() => session.messages.add(UiMessage(role: 'user', text: text, stage: session.stage)));
    _runTurn();
  }

  void _handleRetry() => session.phase == Phase.informe ? _generateReport() : _runTurn();

  void _handleAdvance() {
    final next = session.stage.next;
    if (next == null) {
      _update(() {
        session.phase = Phase.informe;
        session.stageReady = false;
      });
      _generateReport();
      return;
    }
    session.stage = next;
    session.stageReady = false;
    session.foco = null;
    _startStage();
  }

  // La persona quiere volver a un tema que había dejado para más adelante: pasa a estar pendiente de
  // nuevo y la etapa se reabre (hasta que lo cuente o lo vuelva a dejar).
  void _handleResumeTopic(String id) => _update(() {
    session.omitidos[session.stage] = [...?session.omitidos[session.stage]]..remove(id);
    session.stageReady = false;
    session.foco = id;
    session.updatedAt = DateTime.now().toUtc().toIso8601String();
  });

  Future<void> _handleAttachDoc(DocTipo tipo, web.File file) async {
    setState(() => docStatus = tipo == DocTipo.cv ? 'Leyendo tu CV…' : 'Leyendo tu perfil de LinkedIn…');
    try {
      final texto = await extractPdfText(file);
      _update(() {
        session.documentos = [...session.documentos.where((d) => d.tipo != tipo), ProfileDoc(tipo: tipo, nombre: file.name, texto: texto)];
      });
      setState(() => docStatus = null);
    } catch (e) {
      if (mounted) setState(() => docStatus = e is ApiException ? e.message : 'No pudimos leer el PDF.');
    }
  }

  // Entrar al chat, cambiar de fase o de etapa son navegaciones dentro de una SPA: el botón que se
  // tocó desaparece y el foco se pierde (queda en <body>). Se lo lleva al encabezado, que además
  // anuncia dónde está la persona. Se compara con el lugar previo para enfocar una sola vez por cambio.
  void _focusHeadingOnPlaceChange() {
    final place = (phase: session.phase, stage: session.stage);
    if (_prevPlace == place) return;
    _prevPlace = place;
    (web.document.getElementById('phase-heading') as web.HTMLElement?)?.focus();
  }

  Component _stagesNav() {
    final stageIdx = session.stage.index;
    return el('ol', 'ml-auto hidden items-center gap-4 text-xs sm:flex', [
      if (session.path == CoachPath.perfil)
        el('li', session.phase == Phase.perfil ? 'font-semibold text-foreground' : 'text-text-muted', [t('Tu perfil')]),
      for (final (i, s) in Stage.values.indexed)
        () {
          final active = session.phase == Phase.chat && s == session.stage;
          final done = session.phase == Phase.informe || (session.phase == Phase.chat && i < stageIdx);
          // El verde del sistema para la etapa activa; las hechas en el color de texto; las que faltan, apagadas.
          final color = active ? 'var(--color-primary)' : done ? 'var(--color-foreground)' : 'var(--color-text-muted)';
          return el('li', 'flex items-center gap-1.5', [
            el('span', null, [t(done ? '✓' : '${i + 1}.')], attrs: {'aria-hidden': 'true'}),
            t(' '),
            el('span', active ? 'font-semibold' : '', [t(s.label)]),
            when(done, () => el('span', 'sr-only', [t(' (completada)')])),
          ], attrs: {'style': 'color: $color', if (active) 'aria-current': 'step'});
        }(),
    ], attrs: {'role': 'list', 'aria-label': 'Etapas del proceso'});
  }

  Component _reportBody() {
    final informe = session.informe;
    if (informe != null) {
      return ReportView(
        report: informe,
        compromisos: session.compromisos,
        compromisosFecha: session.compromisosFecha,
        onSave: (indices) {
          _update(() {
            session.compromisos = indices;
            session.compromisosFecha = DateTime.now().toUtc().toIso8601String();
          });
          trackEvent('commitments_saved', {'elegidos': indices.length, 'total': informe.acciones.length});
        },
        onRestart: component.onRestart,
      );
    }
    if (error != null) {
      return el('div', 'mx-auto max-w-md rounded-xl border border-danger/20 bg-danger-soft p-4 text-sm text-danger', [
        t('$error '),
        btn('font-semibold underline underline-offset-2', [t('Reintentar')], onClick: _handleRetry),
      ]);
    }
    return el('div', 'mx-auto max-w-sm py-20 text-center', [
      el('div', 'relative mx-auto mb-8 h-16 w-16', [
        el('div', 'ai-ring absolute inset-0 rounded-full', []),
        el('div', 'absolute flex items-center justify-center rounded-full bg-background', [
          el('span', 'text-lg text-text-muted', [t('✦')]),
        ], attrs: {'style': 'inset: 3px'}),
      ]),
      el('p', 'text-sm text-text-muted', [t('Ordenando lo que construiste…')], attrs: {'role': 'status'}),
    ]);
  }

  @override
  Component build(BuildContext context) {
    context.binding.addPostFrameCallback(_focusHeadingOnPlaceChange);
    final chat = session.phase == Phase.chat;
    final heading = switch (session.phase) {
      Phase.perfil => 'Cómo te lee un reclutador',
      Phase.informe => 'Informe de cierre y compromisos',
      Phase.chat => 'Conversación con el coach: ${session.stage.label}',
    };

    // En el chat la página ocupa exactamente la pantalla y no scrollea: lo único que se desplaza es la
    // conversación. Así, al llegar al final, el scroll no "se escapa" y se lleva la tarjeta del chat.
    return el('div', 'flex flex-col bg-background font-sans ${chat ? 'h-dvh overflow-hidden' : 'min-h-screen'}', [
      el('header', 'sticky top-0 z-50 border-b border-border-color bg-background/90 backdrop-blur-sm print:hidden', [
        el('div', 'section-container flex items-center gap-4 py-4', [
          btn('text-sm text-text-muted transition-colors hover:text-foreground', [t('← Inicio')], onClick: component.onExit),
          logo(),
          _stagesNav(),
        ]),
      ]),
      el('main', 'flex-1 px-3 sm:px-4 ${chat ? 'min-h-0 py-3 sm:py-6' : 'py-8'}', [
        // Encabezado para lectores de pantalla: cada fase se ubica por su h1.
        el('h1', 'sr-only', [t(heading)], id: 'phase-heading', attrs: {'tabindex': '-1'}),
        if (session.phase == Phase.perfil)
          ProfileStep(
            initial: session.perfil,
            onReading: (puesto, lectura, documentos) => _update(() {
              session.perfil = ProfileState(puesto: puesto, lectura: lectura, elegidas: []);
              session.documentos = documentos;
            }),
            onContinue: (elegidas) {
              final p = session.perfil;
              if (p == null) return;
              trackEvent('diagnosis_started', {'path': session.path.id});
              session.perfil = p.copyWith(elegidas: elegidas);
              session.phase = Phase.chat;
              _startStage();
            },
          )
        else if (chat)
          ChatView(
            session: session,
            thinking: thinking,
            error: error,
            demo: demo,
            onSend: _handleSend,
            onRetry: _handleRetry,
            onAdvance: _handleAdvance,
            onResumeTopic: _handleResumeTopic,
            onAttachDoc: _handleAttachDoc,
            docStatus: docStatus,
          )
        else
          _reportBody(),
      ]),
    ]);
  }
}
