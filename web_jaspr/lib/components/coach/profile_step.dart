import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';
import 'package:universal_web/web.dart' as web;

import '../../models/docs.dart';
import '../../models/types.dart';
import '../../services/coach_api.dart';
import '../../services/http.dart' show ApiException;
import '../../services/tracking.dart';
import '../../ui.dart';
import '../logo.dart';
import 'doc_inputs.dart';

// Camino B — "cómo te lee un reclutador". La lectura no reemplaza el proceso: la persona elige qué
// recomendaciones toma y eso alimenta el Diagnóstico.

class ProfileStep extends StatelessComponent {
  const ProfileStep({required this.initial, required this.onReading, required this.onContinue, super.key});
  final ProfileState? initial;
  final void Function(String puesto, ProfileReading lectura, List<ProfileDoc> documentos) onReading;
  final void Function(List<int> elegidas) onContinue;

  @override
  Component build(BuildContext context) {
    final i = initial;
    if (i != null) return _ReadingView(state: i, onContinue: onContinue);
    return _ProfileForm(onReading: onReading);
  }
}

Component _svgIcon(List<Component> shapes) => el('svg', 'h-4 w-4', shapes, attrs: {
  'viewBox': '0 0 24 24',
  'fill': 'none',
  'stroke': 'currentColor',
  'stroke-width': '1.8',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
});

Component _path(String d) => el('path', null, [], attrs: {'d': d});

Component _eyeIcon() => _svgIcon([_path('M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z'), el('circle', null, [], attrs: {'cx': '12', 'cy': '12', 'r': '3'})]);
Component _quoteIcon() => _svgIcon([_path('M7 7h4v5a4 4 0 0 1-4 4M15 7h4v5a4 4 0 0 1-4 4')]);
Component _pickIcon() => _svgIcon([
  el('rect', null, [], attrs: {'x': '4', 'y': '4', 'width': '16', 'height': '16', 'rx': '3'}),
  _path('m8.5 12 2.5 2.5 4.5-5'),
]);

Component _stepTitle(int n, String id, String title) => el('h3', 'mb-1.5 flex items-center gap-2.5 text-lg', [
  el('span', 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white font-sans', [t('$n')], attrs: {'aria-hidden': 'true'}),
  t(title),
], id: id);

class _ProfileForm extends StatefulComponent {
  const _ProfileForm({required this.onReading});
  final void Function(String puesto, ProfileReading lectura, List<ProfileDoc> documentos) onReading;

  @override
  State<_ProfileForm> createState() => _ProfileFormState();
}

class _ProfileFormState extends State<_ProfileForm> {
  String puesto = '';
  final drafts = {DocTipo.cv: const DocDraft(), DocTipo.linkedin: const DocDraft()};
  String? status;
  String? error;

  Future<void> _submit() async {
    setState(() => error = null);
    final listos = [for (final tp in DocTipo.values) if (drafts[tp]!.ready) tp];
    try {
      final documentos = <ProfileDoc>[];
      for (final tipo in listos) {
        final d = drafts[tipo]!;
        if (d.mode == DocMode.pdf && d.file != null) {
          setState(() => status = tipo == DocTipo.cv ? 'Leyendo tu CV…' : 'Leyendo tu perfil de LinkedIn…');
          documentos.add(ProfileDoc(tipo: tipo, nombre: d.file!.name, texto: await extractPdfText(d.file!)));
        } else {
          documentos.add(ProfileDoc(tipo: tipo, nombre: 'Texto pegado', texto: d.texto.trim()));
        }
      }
      setState(() => status = documentos.length > 1 ? 'Comparando tu CV y tu LinkedIn como lo haría un reclutador…' : 'Mirándolo como lo haría un reclutador…');
      final lectura = await requestProfileReading(puesto.trim(), documentsToText(documentos) ?? '');
      trackEvent('profile_reading_completed', {'docs': listos.map((e) => e.id).join('+')});
      component.onReading(puesto.trim(), lectura, documentos);
    } catch (e) {
      if (mounted) setState(() => error = e is ApiException ? e.message : 'Algo falló. Intentá de nuevo.');
    } finally {
      if (mounted) setState(() => status = null);
    }
  }

  @override
  Component build(BuildContext context) {
    if (status != null) {
      return el('div', 'mx-auto max-w-sm py-20 text-center', [
        el('div', 'relative mx-auto mb-8 h-16 w-16', [
          el('div', 'ai-ring absolute inset-0 rounded-full', []),
          el('div', 'absolute flex items-center justify-center rounded-full bg-background', [coachAvatar()], attrs: {'style': 'inset: 3px'}),
        ]),
        el('p', 'font-display text-xl text-foreground', [t(status!)], attrs: {'role': 'status'}),
        el('p', 'mt-2 text-sm text-text-muted', [t('Puede tardar unos segundos.')]),
      ]);
    }

    final listos = [for (final tp in DocTipo.values) if (drafts[tp]!.ready) tp];
    final hasPuesto = puesto.trim().length >= 3;
    final ready = hasPuesto && listos.isNotEmpty;
    // Si el botón está apagado, se le dice a la persona qué falta (en vez de dejarla adivinar).
    final missing = !hasPuesto ? 'Contame a qué puesto apuntás para poder seguir.' : listos.isEmpty ? 'Falta tu CV o tu LinkedIn: con uno alcanza.' : null;

    final benefits = [
      (_eyeIcon(), 'Cómo se lee tu perfil', 'La primera impresión: lo que se entiende en los primeros segundos.'),
      (_quoteIcon(), 'Lo que funciona y lo que falta', 'Con frases textuales de tu propio perfil, para que veas de dónde sale cada cosa.'),
      (_pickIcon(), 'Hasta 3 cambios posibles', 'Vos elegís cuáles tomar. Ninguno es obligatorio.'),
    ];

    return el('div', 'mx-auto max-w-2xl', [
      el('header', 'mb-8 text-center', [
        el('p', 'mb-2 text-xs font-semibold uppercase tracking-widest text-primary', [t('Camino B · Tu perfil')]),
        el('h2', 'mb-3', [t('Empecemos por cómo te ve el mercado')]),
        el('p', 'mx-auto max-w-xl text-lg leading-relaxed text-text-muted', [
          t('Voy a leer tu perfil como lo haría un reclutador y a contarte, con frases de tu propio perfil, qué comunica hoy. Después lo conversamos con calma.'),
        ]),
      ]),
      when(error != null, () => el('div', 'mb-5 rounded-2xl border border-danger/20 bg-danger-soft p-3.5 text-sm text-danger', [t(error!)], attrs: {'role': 'alert'})),
      el('section', 'card mb-5', [
        el('h3', 'mb-4', [t('Qué vas a recibir')], id: 'que-recibis'),
        el('ul', 'grid gap-4 sm:grid-cols-3', [
          for (final (icon, title, body) in benefits)
            el('li', 'flex gap-3 sm:block', [
              el('span', 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary sm:mb-2', [icon], attrs: {'aria-hidden': 'true'}),
              el('div', null, [
                el('p', 'text-sm font-semibold text-foreground', [t(title)]),
                el('p', 'mt-0.5 text-sm leading-relaxed text-text-muted', [t(body)]),
              ]),
            ]),
        ], attrs: {'role': 'list'}),
        el('p', 'mt-5 rounded-2xl bg-secondary p-3.5 text-sm leading-relaxed text-text-muted', [
          el('strong', 'font-semibold text-foreground', [t('Lo que no hago:')]),
          t(' no reescribo tu CV, no invento logros que no tengas y la nota mide qué tan bien comunica tu perfil, no cuánto valés como profesional.'),
        ]),
      ], attrs: {'aria-labelledby': 'que-recibis'}),
      el('section', 'card mb-5', [
        _stepTitle(1, 'paso-puesto', '¿A qué tipo de puesto apuntás?'),
        el('p', 'mb-3 text-sm text-text-muted', [t('La misma experiencia se lee distinto según el puesto al que apuntás. Por eso lo necesito.')]),
        el('input', 'w-full rounded-2xl border border-border-color bg-background p-3.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/15', [],
          id: 'puesto',
          attrs: {'type': 'text', 'aria-labelledby': 'paso-puesto', 'maxlength': '200', 'placeholder': 'Ej: Product Manager en fintech, Analista de datos senior…'},
          on: events<String>(onInput: (v) => setState(() => puesto = v))),
      ], attrs: {'aria-labelledby': 'paso-puesto'}),
      el('section', 'card mb-5', [
        _stepTitle(2, 'paso-perfil', 'Mostrame tu perfil'),
        el('p', 'mb-4 text-sm text-text-muted', [t('Con uno alcanza. Si compartís los dos, además veo si tu CV y tu LinkedIn cuentan la misma historia.')]),
        el('div', 'space-y-3', [
          for (final tp in DocTipo.values)
            DocSlot(key: ValueKey(tp), tipo: tp, draft: drafts[tp]!, onChange: (d) => setState(() => drafts[tp] = d)),
        ]),
        el('p', 'mt-4 text-xs leading-relaxed text-text-muted', [
          t('Se lee solo durante esta sesión y no se guarda en ningún servidor. '),
          anchor('underline underline-offset-2', '#privacidad', [t('Cómo cuidamos tus datos')], external: true),
        ]),
      ], attrs: {'aria-labelledby': 'paso-perfil'}),
      el('button', 'btn-primary w-full py-3.5 text-base disabled:cursor-not-allowed disabled:opacity-40', [t('Ver cómo me lee un reclutador →')],
        attrs: {'type': 'button', if (!ready) 'disabled': '', if (missing != null) 'aria-describedby': 'falta'},
        on: events(onClick: _submit)),
      el('p', 'mt-3 min-h-5 text-center text-sm text-text-muted', [t(missing ?? '')], id: 'falta'),
    ]);
  }
}

Component _cita(String cita, String? fuente) {
  if (cita.isEmpty) return const Component.empty();
  return el('span', 'mt-1 block text-xs italic text-text-muted', [
    when(fuente != null && fuente.isNotEmpty, () => el('span', 'mr-1.5 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold not-italic uppercase', [t(fuente!)])),
    t('“$cita”'),
  ]);
}

class _ReadingView extends StatefulComponent {
  const _ReadingView({required this.state, required this.onContinue});
  final ProfileState state;
  final void Function(List<int>) onContinue;

  @override
  State<_ReadingView> createState() => _ReadingViewState();
}

class _ReadingViewState extends State<_ReadingView> {
  late List<int> elegidas = [...component.state.elegidas];

  @override
  void initState() {
    super.initState();
    // Al pasar del formulario a la lectura el botón desaparece: se lleva el foco al título.
    context.binding.addPostFrameCallback(() => (web.document.getElementById('lectura-titulo') as web.HTMLElement?)?.focus());
  }

  void _toggle(int i) => setState(() => elegidas.contains(i) ? elegidas.remove(i) : elegidas.add(i));

  Component _observationList(String title, List<Observation> items) => el('div', 'card', [
    el('p', 'mb-3 text-xs font-semibold uppercase tracking-widest text-text-muted', [t(title)]),
    el('ul', 'space-y-3', [
      for (final it in items) el('li', 'text-sm leading-relaxed text-foreground', [t(it.observacion), _cita(it.cita, it.fuente)]),
    ]),
  ]);

  @override
  Component build(BuildContext context) {
    final puesto = component.state.puesto;
    final lectura = component.state.lectura;
    // Máximo tres cambios concretos, aunque el modelo devuelva más.
    final recomendaciones = lectura.recomendaciones.take(3).toList();

    return el('div', 'ai-result mx-auto max-w-2xl', [
      el('div', 'mb-8 text-center', [
        el('p', 'mb-2 text-xs font-semibold uppercase tracking-widest text-text-muted', [t('Lectura externa · $puesto')]),
        el('h2', 'outline-none', [t('Cómo te lee un reclutador')], id: 'lectura-titulo', attrs: {'tabindex': '-1'}),
      ]),
      el('div', 'flex flex-col gap-4', [
        el('div', 'rounded-2xl border border-accent/30 bg-accent-soft p-5', [
          el('div', 'flex items-baseline gap-3', [
            el('span', 'text-3xl font-semibold text-accent-ink', [t('${lectura.nota}/10')]),
            el('p', 'text-sm font-medium text-accent-ink', [t(lectura.notaComunica)]),
          ]),
          el('p', 'mt-2 text-xs leading-relaxed text-accent-ink', [
            t('Esta nota mide qué tan bien tu perfil comunica hoy lo que buscan para “$puesto”. No mide cuánto valés como profesional, ni tu formación, ni tu experiencia real.'),
          ]),
        ]),
        el('div', 'card', [
          el('p', 'mb-2 text-xs font-semibold uppercase tracking-widest text-text-muted', [t('Primera impresión')]),
          el('p', 'text-sm leading-relaxed text-foreground', [t(lectura.primeraImpresion)]),
          el('p', 'mt-3 text-sm leading-relaxed text-text-muted', [t(lectura.consistenciaMarca)]),
        ]),
        el('div', 'grid gap-4 md:grid-cols-2', [
          _observationList('Lo que ya comunica bien', lectura.fortalezas),
          _observationList('Lo que no aparece', lectura.ausencias),
        ]),
        el('div', 'card', [
          el('p', 'mb-1 text-xs font-semibold uppercase tracking-widest text-text-muted', [t('Hasta 3 cambios posibles')]),
          el('p', 'mb-4 text-sm text-text-muted', [t('Son sugerencias. Marcá las que querés tomar; las demás quedan afuera.')]),
          el('ul', 'space-y-3', [
            for (final (i, r) in recomendaciones.indexed)
              el('li', null, [
                el('label', 'flex cursor-pointer gap-3 rounded-xl border border-border-color p-4 transition hover:bg-secondary', [
                  input<bool>(type: InputType.checkbox, checked: elegidas.contains(i), classes: 'mt-1 accent-primary', onChange: (_) => _toggle(i)),
                  el('div', null, [
                    el('p', 'text-sm font-semibold text-foreground', [t(r.cambio)]),
                    el('p', 'mt-1 text-sm text-text-muted', [t(r.porQue)]),
                    when(r.cita.isNotEmpty, () => el('p', 'mt-2 border-l-2 border-border-color pl-3', [_cita(r.cita, r.fuente)])),
                    when(r.tipo == 'decision_personal', () => el('p', 'mt-2 inline-block rounded-full bg-secondary px-2.5 py-0.5 text-xs text-text-muted', [
                      t('Convención de mercado · la decisión es tuya'),
                    ])),
                  ]),
                ]),
              ]),
          ]),
        ]),
      ]),
      el('div', 'mt-8 rounded-2xl bg-foreground p-6 text-center text-white', [
        el('p', 'mb-4 text-sm', [t('Ahora lo conversamos: qué te resonó, qué no y qué querés hacer con esto. Esa charla es el Diagnóstico.')], attrs: {'style': 'color: rgba(255,255,255,0.75)'}),
        btn('rounded-xl bg-card px-7 py-3 font-semibold text-foreground transition hover:shadow-lg active:scale-95', [t('Empezar la conversación →')], onClick: () => component.onContinue(elegidas)),
      ]),
    ]);
  }
}
