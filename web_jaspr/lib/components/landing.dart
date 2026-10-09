import 'package:jaspr/jaspr.dart';

import '../models/stages.dart';
import '../models/types.dart';
import '../ui.dart';

// Pantalla de inicio — Variante 1 del mockup de Lovable ("Dos caminos lado a lado"). Los dos
// caminos del guardrail quedan visibles de entrada.

Component _icon(List<Component> shapes) => el('svg', 'h-5 w-5', shapes, attrs: {
  'viewBox': '0 0 24 24',
  'fill': 'none',
  'stroke': 'currentColor',
  'stroke-width': '1.8',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
  'aria-hidden': 'true',
});

Component _p(String d) => el('path', null, [], attrs: {'d': d});

Component _routeIcon() => _icon([_p('M17 2l4 4-4 4'), _p('M3 11v-1a4 4 0 0 1 4-4h14'), _p('M7 22l-4-4 4-4'), _p('M21 13v1a4 4 0 0 1-4 4H3')]);

Component _searchIcon() => _icon([
  el('circle', null, [], attrs: {'cx': '11', 'cy': '11', 'r': '7'}),
  _p('m20 20-3.5-3.5'),
]);

class _PathCard {
  const _PathCard(this.path, this.tag, this.icon, this.title, this.body);
  final CoachPath path;
  final String tag;
  final Component Function() icon;
  final String title;
  final String body;
}

final _paths = [
  _PathCard(
    CoachPath.quiebre,
    'Camino A',
    _routeIcon,
    'Me siento estancado/a y no sé qué hacer con eso',
    'Llevás un tiempo con la misma duda: ¿me quedo, intento crecer acá o toca cambiar de rumbo? Podemos ponerle palabras y orden de prioridad a esa pregunta.',
  ),
  _PathCard(
    CoachPath.perfil,
    'Camino B',
    _searchIcon,
    'Quiero explorar el mercado, empezando por mi perfil',
    'Te interesan nuevas oportunidades, pero antes de salir a buscar querés saber qué comunica tu perfil hoy para los puestos que te atraen.',
  ),
];

String _resumeText(Session s) {
  if (s.compromisos != null) {
    final n = s.compromisos!.length;
    return 'Asumiste $n compromiso${n == 1 ? '' : 's'}. Retomá desde ahí.';
  }
  if (s.phase == Phase.informe) return 'Tu informe de cierre te espera para elegir tus compromisos.';
  return 'Quedaste en ${s.stage.label}.';
}

Component landing({required void Function(CoachPath) onChoosePath, required Session? saved, required void Function() onResume}) {
  return el('section', 'py-16 md:py-24', [
    el('div', 'section-container', [
      when(saved != null, () => el('div', 'mx-auto mb-12 flex max-w-4xl flex-col gap-3 rounded-2xl border border-primary/20 bg-card p-5 sm:flex-row sm:items-center sm:justify-between', [
        el('div', null, [
          el('p', 'text-sm font-semibold text-foreground', [t('Tenés un proceso en curso')]),
          el('p', 'text-sm text-text-muted', [t(_resumeText(saved!))]),
        ]),
        btn('btn-primary shrink-0 px-5 py-2.5 text-sm', [t('Retomar →')], onClick: onResume),
      ])),
      el('div', 'mx-auto mb-12 max-w-3xl text-center', [
        el('p', 'mb-4 text-xs font-semibold uppercase tracking-widest text-primary', [t('Un momento para decidir')]),
        el('h1', 'mb-5 leading-tight', [t('Antes de empezar: ¿dónde estás parada o parado hoy?')]),
        el('p', 'mx-auto max-w-xl text-lg leading-relaxed text-text-muted', [
          t('Elegí el punto de partida que más se parezca a tu situación. No es un test y no queda nada definido hoy: lo afinamos conversando.'),
        ]),
      ]),
      el('div', 'mx-auto grid max-w-4xl gap-5 md:grid-cols-2', [
        for (final p in _paths)
          el('div', 'card flex flex-col p-7', [
            el('div', 'mb-6 flex items-center justify-between', [
              el('span', 'rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary', [t(p.tag)]),
              el('span', 'flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-lg text-primary', [p.icon()], attrs: {'aria-hidden': 'true'}),
            ]),
            el('h2', 'mb-3 text-xl leading-snug', [t(p.title)]),
            el('p', 'mb-8 flex-1 text-sm leading-relaxed text-text-muted', [t(p.body)]),
            // Mismo estilo en los dos: ningún camino se presenta como el recomendado.
            btn('btn-primary w-full py-3', [t('Empezar por acá')], onClick: () => onChoosePath(p.path)),
          ]),
      ]),
      el('div', 'mx-auto mt-14 max-w-3xl text-center', [
        el('p', 'mb-5 text-xs font-semibold uppercase tracking-widest text-text-muted', [t('Los dos caminos llevan al mismo proceso acompañado')]),
        el('ol', 'flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-6', [
          for (final (i, s) in Stage.values.indexed)
            el('li', 'flex items-center gap-2.5 text-sm text-foreground', [
              el('span', 'flex h-7 w-7 items-center justify-center rounded-full border border-border-color bg-card text-xs font-semibold text-primary', [t('${i + 1}')]),
              t(s == Stage.discovery ? 'Exploración de opciones' : s.label),
              when(i < 2, () => el('span', 'hidden text-border-color sm:inline', [t('—')])),
            ]),
        ]),
        el('p', 'mt-5 text-sm text-text-muted', [t('Conversación guiada con preguntas — no veredictos, ni respuestas automáticas.')]),
      ]),
    ]),
  ], id: 'profesional');
}
