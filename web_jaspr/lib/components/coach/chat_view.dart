import 'dart:math' as math;

import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';
import 'package:universal_web/web.dart' as web;

import '../../i18n/i18n.dart';
import '../../models/stages.dart';
import '../../models/types.dart';
import '../../ui.dart';
import '../logo.dart';
import 'doc_inputs.dart';
import 'profile_step.dart' show signalList;
import 'stage_map.dart';

String _nextLabel(Stage stage) => tl('chat.next.${stage.id}');

// Para vencer la hoja en blanco: frases para arrancar que la persona puede editar.
List<String> _starters(CoachPath path) => [for (var n = 1; n <= 3; n++) tl('chat.starters.${path.id}.$n')];

String _formatDate(String? iso) {
  final d = iso == null ? null : DateTime.tryParse(iso);
  if (d == null) return '';
  return currentLang == Lang.en ? '${d.month}/${d.day}/${d.year}' : '${d.day}/${d.month}/${d.year}';
}

const _inputId = 'chat-input';
const _logId = 'chat-log';

void _grow(web.HTMLTextAreaElement ta) {
  ta.style.height = 'auto';
  ta.style.height = '${math.min(ta.scrollHeight, 160)}px';
}

web.HTMLTextAreaElement? _input() => web.document.getElementById(_inputId) as web.HTMLTextAreaElement?;

class ChatView extends StatefulComponent {
  const ChatView({
    required this.session,
    required this.thinking,
    required this.error,
    required this.demo,
    required this.onSend,
    required this.onRetry,
    required this.onAdvance,
    required this.onAttachDoc,
    required this.onResumeTopic,
    required this.docStatus,
    super.key,
  });

  final Session session;
  final bool thinking;
  final String? error;
  final bool demo;
  final void Function(String text) onSend;
  final void Function() onRetry;
  final void Function() onAdvance;
  final void Function(DocTipo, web.File) onAttachDoc;
  final void Function(String id) onResumeTopic;
  final String? docStatus;

  @override
  State<ChatView> createState() => _ChatViewState();
}

class _ChatViewState extends State<ChatView> {
  String draft = '';
  bool docsOpen = false;
  bool recapOpen = false;
  // En pantallas táctiles Enter da un salto de línea (se envía con el botón): ahí se escriben textos largos.
  late final bool touch = web.window.matchMedia('(pointer: coarse)').matches;
  String _scrollKey = '';

  Session get session => component.session;

  void _setDraft(String text) {
    final ta = _input();
    if (ta != null) {
      ta.value = text;
      _grow(ta);
      ta.focus();
    }
    setState(() => draft = text);
  }

  void _send() {
    final text = draft.trim();
    if (text.isEmpty || component.thinking) return;
    component.onSend(text);
    final ta = _input();
    if (ta != null) {
      ta.value = '';
      _grow(ta);
    }
    setState(() => draft = '');
  }

  // Lleva la conversación al último mensaje (sin animación si la persona pidió reducir el movimiento).
  void _scrollEffect(String key, bool showMap) {
    if (key == _scrollKey) return;
    _scrollKey = key;
    final log = web.document.getElementById(_logId);
    if (log == null) return;
    final calm = web.window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // El mapa de cierre es alto: cuando recién llega se muestra desde su título, no desde sus botones.
    final map = showMap ? log.querySelector('#stage-map') : null;
    final top = map != null
        ? map.getBoundingClientRect().top - log.getBoundingClientRect().top + log.scrollTop - 12
        : log.scrollHeight.toDouble();
    log.scrollTo(web.ScrollToOptions(top: top, behavior: calm ? 'auto' : 'smooth'));
  }

  @override
  Component build(BuildContext context) {
    final visible = session.messages.where((m) => !m.hidden).toList();
    final hasUserMessage = visible.any((m) => m.isUser);

    // El mapa se muestra justo después del mensaje que cerró la etapa; lo que la persona escriba
    // después queda debajo. (Sesiones guardadas antes de esta marca: al final de la conversación.)
    var mapIndex = -1;
    if (session.stageReady) {
      mapIndex = visible.lastIndexWhere((m) => m.cierraEtapa && m.stage == session.stage);
      if (mapIndex == -1) mapIndex = visible.length - 1;
    }
    final lastIsClosing = mapIndex == visible.length - 1;

    final key = '${visible.length}|${component.thinking}|${session.stageReady}|$lastIsClosing';
    context.binding.addPostFrameCallback(() => _scrollEffect(key, session.stageReady && lastIsClosing));

    return el('div', 'mx-auto h-full w-full max-w-3xl', [
      el('section', 'card relative flex h-full min-h-0 flex-col overflow-hidden p-0', [
        _header(),
        // Región con scroll propio: enfocable con teclado (tabindex) para poder leer el historial.
        el('div', 'relative flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6', [
          when(component.demo, () => el('div', 'rounded-xl border border-accent/30 bg-accent-soft px-4 py-2.5 text-xs text-accent-ink', [
            t(tl('chat.demo')),
          ])),
          when(!hasUserMessage, _onboarding),
          for (final (i, m) in visible.indexed)
            el('div', 'space-y-3', [
              when(i == 0 || (i > 0 && visible[i - 1].stage != m.stage), () => _stageDivider(m.stage)),
              m.isUser ? _userBubble(m.text) : _coachBubble(m.text, m.fuentes, m.fechaDatos),
              when(m.derivacion, _derivationCard),
              when(i == mapIndex, () => stageMap(
                stage: session.stage,
                path: session.path,
                map: session.mapas[session.stage],
                fallbackText: session.sintesis[session.stage],
                nextLabel: _nextLabel(session.stage),
                onAdvance: component.onAdvance,
                onAdjust: () => _input()?.focus(),
                onResume: (id) {
                  component.onResumeTopic(id);
                  final label = objectivesFor(session.stage, session.path).where((o) => o.id == id).firstOrNull?.label ?? '';
                  _setDraft(tl('chat.resumeDraft', {'label': label}));
                },
              )),
            ]),
          when(component.thinking, _typing),
          when(component.error != null, () => el('div', 'flex items-center justify-between gap-3 rounded-2xl border border-danger/20 bg-danger-soft p-3.5 text-sm text-danger', [
            el('span', null, [t(component.error!)]),
            btn('shrink-0 font-semibold underline underline-offset-2', [t(tl('common.retry'))], onClick: component.onRetry),
          ], attrs: {'role': 'alert'})),
        ], id: _logId, attrs: {'role': 'log', 'aria-live': 'polite', 'aria-label': tl('chat.log'), 'tabindex': '0'}),

        // El cierre no se pierde: aunque la persona siga escribiendo, el botón para seguir queda a la vista.
        when(session.stageReady, () => el('div', 'flex flex-wrap items-center justify-between gap-2 border-t border-primary/20 bg-primary-soft px-4 py-2.5 sm:px-6', [
          el('p', 'text-sm font-medium text-primary', [t(tl('chat.mapReady', {'stage': session.stage.label}))]),
          btn('btn-primary px-5 py-2 text-sm', [t(_nextLabel(session.stage))], onClick: component.onAdvance),
        ])),

        _composer(),
      ], attrs: {'aria-label': tl('chat.section')}),
    ]);
  }

  Component _composer() {
    final canSend = draft.trim().isNotEmpty && !component.thinking;
    return el('footer', 'border-t border-border-color bg-card p-3 sm:p-4 [@media(max-height:560px)]:p-2', [
      el('div', 'flex items-end gap-2 rounded-2xl border border-border-color bg-background p-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15', [
        el('textarea', 'max-h-40 min-h-11 flex-1 resize-none bg-transparent px-2 py-1.5 text-base leading-6 outline-none placeholder:text-text-muted/70', [],
          id: _inputId,
          attrs: {'rows': '1', 'maxlength': '4000', 'placeholder': tl('chat.placeholder'), 'aria-label': tl('chat.answerLabel')},
          on: {
            'input': (e) {
              final ta = e.target as web.HTMLTextAreaElement;
              _grow(ta);
              setState(() => draft = ta.value);
            },
            'keydown': (e) {
              final k = e as web.KeyboardEvent;
              if (k.key == 'Enter' && !k.shiftKey && !touch && !k.isComposing) {
                k.preventDefault();
                _send();
              }
            },
          }),
        btn('btn-primary h-11 shrink-0 px-5 text-sm disabled:cursor-not-allowed disabled:opacity-40', [t(tl('common.send'))], onClick: _send, disabled: !canSend),
      ]),
      el('p', 'mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] text-text-muted [@media(max-height:560px)]:hidden', [
        el('span', null, [t(touch ? tl('chat.hint.touch') : tl('chat.hint.keyboard'))]),
        el('span', 'inline-flex items-center gap-1', [_lockIcon(), t(' ${tl('chat.privacy')}')]),
      ]),
    ]);
  }

  // Camino B: la lectura del perfil y los cambios elegidos quedan a mano arriba del chat (cerrados,
  // para no quitar lugar a la conversación) en vez de desaparecer al pasar al Diagnóstico.
  Component _profileRecap() {
    final perfil = session.perfil!;
    final lectura = perfil.lectura;
    final recs = lectura.recomendaciones.take(3).toList();
    final chosen = [for (final (i, r) in recs.indexed) if (perfil.elegidas.contains(i)) r];
    final skipped = [for (final (i, r) in recs.indexed) if (!perfil.elegidas.contains(i)) r];
    const label = 'text-xs font-semibold uppercase tracking-widest text-text-muted';

    return el('div', 'mt-2.5', [
      el(
        'button',
        'flex w-full items-center justify-between gap-3 rounded-xl bg-secondary px-3.5 py-2 text-left text-xs transition hover:bg-primary-soft',
        [
          el('span', 'min-w-0', [
            el('span', 'block font-semibold text-foreground', [t(tl('chat.profile.title'))]),
            el('span', 'block truncate text-text-muted', [t(tln('chat.profile.sub', chosen.length, {'role': perfil.puesto}))]),
          ]),
          el('span', 'text-text-muted', [t(recapOpen ? '−' : '+')], attrs: {'aria-hidden': 'true'}),
        ],
        attrs: {'type': 'button', 'aria-expanded': '$recapOpen', 'aria-controls': 'panel-lectura'},
        on: events(onClick: () => setState(() => recapOpen = !recapOpen)),
      ),
      when(recapOpen, () => el('div', 'mt-2 max-h-64 space-y-4 overflow-y-auto rounded-xl bg-secondary p-4 text-sm leading-relaxed text-foreground', [
        el('p', null, [t(lectura.resumen)]),
        when(lectura.senales.isNotEmpty, () => signalList(lectura.senales)),
        el('div', null, [
          el('p', 'mb-1.5 $label', [t(tl('chat.profile.changes'))]),
          chosen.isNotEmpty
              ? el('ul', 'list-disc space-y-1 pl-5', [for (final r in chosen) el('li', null, [t(r.cambio)])])
              : el('p', 'text-text-muted', [t(tl('chat.profile.none'))]),
        ]),
        when(skipped.isNotEmpty, () => el('div', null, [
          el('p', 'mb-1.5 $label', [t(tl('chat.profile.skipped'))]),
          el('ul', 'list-disc space-y-1 pl-5 text-text-muted', [for (final r in skipped) el('li', null, [t(r.cambio)])]),
        ])),
      ], id: 'panel-lectura')),
    ]);
  }

  // ── Encabezado: quién es el coach y dónde estás ─────────────────────────────

  Component _header() {
    final idx = session.stage.index;
    final objetivos = objectivesFor(session.stage, session.path);
    final cubiertos = session.cubiertos[session.stage] ?? const <String>[];
    final omitidos = session.omitidos[session.stage] ?? const <String>[];
    final fraction = objetivos.isEmpty ? 0.0 : cubiertos.length / objetivos.length;
    final intro = introFor(session.stage, session.path);
    final docsLabel = session.documentos.isNotEmpty ? tl('chat.docs.profile', {'docs': session.documentos.map((d) => d.tipo.label).join(' + ')}) : tl('chat.docs.add');

    return el('header', 'border-b border-border-color bg-card px-4 py-3 sm:px-6', [
      el('div', 'flex items-center gap-3', [
        coachAvatar(),
        el('div', 'min-w-0 flex-1', [
          el('p', 'truncate font-display text-lg leading-tight text-foreground', [t(tl('chat.title'))]),
          el('p', 'truncate text-xs text-text-muted [@media(max-height:560px)]:hidden', [t(tl('chat.subtitle'))]),
        ]),
        el(
          'button',
          'btn-secondary h-10 shrink-0 gap-1.5 px-3 py-0 text-xs sm:px-3.5',
          [
            _paperclipIcon(),
            // En celular solo el ícono (el texto queda para lectores de pantalla).
            el('span', 'sr-only sm:not-sr-only', [t(docsLabel)]),
          ],
          attrs: {'type': 'button', 'aria-expanded': '$docsOpen', 'aria-controls': 'panel-documentos'},
          on: events(onClick: () => setState(() => docsOpen = !docsOpen)),
        ),
      ]),
      when(docsOpen, () => el('div', 'mt-3 rounded-2xl bg-secondary p-4', [
        DocsPanel(docs: session.documentos, status: component.docStatus, onAttach: component.onAttachDoc),
      ], id: 'panel-documentos')),

      when(session.perfil != null, _profileRecap),

      // Dónde estás: etapa, qué se hace ahora y qué viene después.
      el('div', 'mt-2.5', [
        el('div', 'flex items-baseline justify-between gap-3 text-xs', [
          el('p', 'font-semibold text-primary', [t(tl('chat.stageOf', {'n': idx + 1, 'total': Stage.values.length, 'stage': session.stage.label}))]),
          el('p', 'hidden text-text-muted sm:block', [t(tl('chat.after', {'next': intro.despues}))]),
        ]),
        el('div', 'mt-2 flex gap-1.5', [
          for (final s in Stage.values)
            el('span', 'h-1.5 flex-1 overflow-hidden rounded-full bg-secondary', [
              el('span', 'block h-full rounded-full bg-primary transition-all duration-500', [], attrs: {
                'style': 'width: ${s.index < idx ? 100 : s.index == idx ? math.max(fraction * 100, 8) : 0}%',
              }),
            ]),
        ], attrs: {'aria-hidden': 'true'}),
        el('p', 'mt-1.5 hidden text-xs text-text-muted sm:block [@media(max-height:560px)]:hidden', [t(tl('chat.now', {'what': intro.queHacemos}))]),

        // Con poca altura (teclado abierto, celular horizontal) se deja más lugar a la conversación.
        el('ul', 'mt-1.5 flex flex-wrap gap-1.5 [@media(max-height:560px)]:hidden', [
          for (final o in objetivos) _topicChip(o, cubiertos, omitidos),
        ], attrs: {'role': 'list', 'aria-label': tl('chat.topics')}),
      ]),
    ]);
  }

  Component _topicChip(StageObjective o, List<String> cubiertos, List<String> omitidos) {
    final done = cubiertos.contains(o.id);
    final dejado = !done && omitidos.contains(o.id);
    // El tema por el que el coach está preguntando ahora (y que todavía no se contestó).
    final enFoco = !done && !dejado && session.foco == o.id;
    final style = done
        ? 'bg-primary-soft font-medium text-primary'
        : dejado
            ? 'border border-dashed border-text-muted/60 text-text-muted'
            : enFoco
                ? 'border border-accent bg-accent-soft font-medium text-accent-ink'
                : 'border border-border-color text-text-muted';
    return el('li', 'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs $style', [
      when(done, _checkIcon),
      when(enFoco, () => el('span', 'h-1.5 w-1.5 rounded-full bg-accent', [], attrs: {'aria-hidden': 'true'})),
      t(o.label),
      when(dejado, () => el('span', null, [t(tl('chat.topic.laterTag'))], attrs: {'aria-hidden': 'true'})),
      // El estado no puede depender solo del color o del ícono.
      el('span', 'sr-only', [
        t(done
            ? tl('chat.topic.done')
            : dejado
                ? tl('chat.topic.later')
                : enFoco
                    ? tl('chat.topic.focus')
                    : tl('chat.topic.pending')),
      ]),
    ]);
  }

  // ── Mensajes ────────────────────────────────────────────────────────────────

  Component _coachBubble(String text, List<MarketSource> fuentes, String? fecha) => el('div', 'flex items-start gap-3', [
    coachAvatar(small: true),
    el('div', 'max-w-[88%] rounded-2xl rounded-tl-md border border-border-color bg-background px-4 py-3 text-[15px] leading-7 text-foreground sm:text-base', [
      el('p', 'whitespace-pre-wrap', [
        el('span', 'sr-only', [t(tl('chat.coachSays'))]),
        t(text),
      ]),
      when(fuentes.isNotEmpty, () => el('div', 'mt-3 border-t border-border-color pt-2.5 text-xs leading-relaxed text-text-muted', [
        el('p', 'font-semibold', [t(tl('chat.sources.title', {'date': _formatDate(fecha)}))]),
        el('ul', 'mt-1 flex flex-wrap gap-x-3 gap-y-1', [
          for (final f in fuentes)
            el('li', null, [
              el('a', 'underline underline-offset-2 hover:text-foreground', [t(f.titulo)], attrs: {'href': f.url, 'target': '_blank', 'rel': 'noopener noreferrer'}),
            ]),
        ]),
        el('p', 'mt-1', [t(tl('chat.sources.note'))]),
      ])),
    ]),
  ]);

  Component _userBubble(String text) => el('div', 'flex justify-end', [
    el('div', 'max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary-soft px-4 py-3 text-[15px] leading-7 text-foreground sm:text-base', [
      el('span', 'sr-only', [t(tl('chat.youSay'))]),
      t(text),
    ]),
  ]);

  Component _typing() => el('div', 'flex items-start gap-3', [
    coachAvatar(small: true),
    el('div', 'flex items-center gap-2.5 rounded-2xl rounded-tl-md border border-border-color bg-background px-4 py-3.5', [
      el('span', 'sr-only', [t(tl('chat.typing.sr'))]),
      el('span', 'flex gap-1', [
        for (var d = 0; d < 3; d++)
          el('span', 'h-1.5 w-1.5 rounded-full bg-primary', [], attrs: {'style': 'animation: ai-pulse-glow 1.2s ${d * 0.2}s infinite'}),
      ], attrs: {'aria-hidden': 'true'}),
      el('span', 'text-xs italic text-text-muted', [t(tl('chat.typing'))], attrs: {'aria-hidden': 'true'}),
    ]),
  ]);

  // Antes del primer mensaje: cómo funciona, y frases para arrancar.
  Component _onboarding() => el('div', 'rounded-2xl border border-border-color bg-secondary/50 p-5 text-sm', [
    el('p', 'mb-3 font-display text-lg text-foreground', [t(tl('chat.onb.title'))]),
    el('ul', 'space-y-2 leading-relaxed text-text-muted', [
      el('li', null, [
        el('strong', 'font-semibold text-foreground', [t(tl('chat.onb.1.strong'))]),
        t(tl('chat.onb.1.rest')),
      ]),
      el('li', null, [
        el('strong', 'font-semibold text-foreground', [t(tl('chat.onb.2.strong'))]),
        t(tl('chat.onb.2.rest')),
      ]),
      el('li', null, [
        el('strong', 'font-semibold text-foreground', [t(tl('chat.onb.3.strong'))]),
        t('${tl('chat.onb.3.rest')} '),
        anchor('underline underline-offset-2', '#privacidad', [t(tl('chat.onb.3.link'))], external: true),
      ]),
    ]),
    el('p', 'mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-text-muted', [t(tl('chat.onb.stuck'))]),
    el('ul', 'flex flex-wrap gap-2', [
      for (final text in _starters(session.path))
        el('li', null, [
          btn('rounded-full border border-border-color bg-card px-3.5 py-2 text-left text-sm text-foreground transition hover:border-primary hover:bg-primary-soft', [t(text)], onClick: () => _setDraft(text)),
        ]),
    ], attrs: {'role': 'list'}),
  ]);

  Component _stageDivider(Stage stage) => el('div', 'flex items-center gap-3 py-1', [
    el('span', 'h-px flex-1 bg-border-color', []),
    el('span', 'text-xs font-semibold uppercase tracking-widest text-text-muted', [t(stage.label)]),
    el('span', 'h-px flex-1 bg-border-color', []),
  ]);

  // Protocolo de derivación. Los recursos son de Argentina (zona horaria del equipo); a validar con el equipo antes de producción.
  Component _derivationCard() => el('div', 'ml-11 max-w-[88%] rounded-2xl border border-primary/20 bg-primary-soft p-4 text-sm text-foreground', [
    el('p', 'mb-2 font-semibold text-primary', [t(tl('chat.deriv.title'))]),
    el('ul', 'list-disc space-y-1 pl-5', [
      el('li', null, [t(tl('chat.deriv.1'))]),
      el('li', null, [t(tl('chat.deriv.2'))]),
      el('li', null, [t(tl('chat.deriv.3'))]),
      el('li', null, [t(tl('chat.deriv.4'))]),
    ]),
    el('p', 'mt-2 text-xs text-text-muted', [t('${tl('chat.deriv.country')} ${tl('chat.deriv.after')}')]),
  ]);

  // ── Íconos ──────────────────────────────────────────────────────────────────

  Component _svg(String cls, List<Component> shapes) => el('svg', cls, shapes, attrs: {
    'viewBox': '0 0 24 24',
    'fill': 'none',
    'stroke': 'currentColor',
    'stroke-width': '2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
  });

  Component _path(String d) => el('path', null, [], attrs: {'d': d});

  Component _checkIcon() => _svg('h-3 w-3', [_path('m5 12 5 5L20 7')]);

  Component _lockIcon() => _svg('h-3 w-3', [
    el('rect', null, [], attrs: {'x': '5', 'y': '11', 'width': '14', 'height': '9', 'rx': '2'}),
    _path('M8 11V8a4 4 0 0 1 8 0v3'),
  ]);

  Component _paperclipIcon() => _svg('h-3.5 w-3.5 shrink-0', [
    _path('m21 11.5-8.6 8.6a5 5 0 0 1-7-7l8.6-8.6a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.6a1.7 1.7 0 0 1-2.3-2.4l8-8'),
  ]);
}
