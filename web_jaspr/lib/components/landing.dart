import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';

import '../i18n/i18n.dart';
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

Component _capIcon() => _icon([
  _p('M22 9 12 4 2 9l10 5 10-5Z'),
  _p('M6 11.5V16c0 1.2 2.7 3 6 3s6-1.8 6-3v-4.5'),
]);

Component _routeIcon() => _icon([_p('M17 2l4 4-4 4'), _p('M3 11v-1a4 4 0 0 1 4-4h14'), _p('M7 22l-4-4 4-4'), _p('M21 13v1a4 4 0 0 1-4 4H3')]);

Component _searchIcon() => _icon([
  el('circle', null, [], attrs: {'cx': '11', 'cy': '11', 'r': '7'}),
  _p('m20 20-3.5-3.5'),
]);

class _PathCard {
  const _PathCard(this.path, this.tag, this.icon, this.title, this.body, [this.note]);
  final CoachPath path;
  final String tag;
  final Component Function() icon;
  final String title;
  final String body;
  final String? note;
}

// Se arma al dibujar: los textos dependen del idioma actual.
List<_PathCard> _paths() => [
  _PathCard(CoachPath.quiebre, tl('landing.pathA.tag'), _routeIcon, tl('landing.pathA.title'), tl('landing.pathA.body')),
  _PathCard(CoachPath.perfil, tl('landing.pathB.tag'), _searchIcon, tl('landing.pathB.title'), tl('landing.pathB.body')),
  _PathCard(CoachPath.formacion, tl('landing.pathC.tag'), _capIcon, tl('landing.pathC.title'), tl('landing.pathC.body'), tl('landing.pathC.note')),
];

String _resumeText(Session s) {
  if (s.compromisos != null) return tln('landing.resume.commitments', s.compromisos!.length);
  if (s.phase == Phase.informe) return tl('landing.resume.report');
  if (s.phase == Phase.perfil) return tl('process.status.profile');
  return tl('landing.resume.stage', {'stage': s.stage.label});
}

String _date(Session s) {
  final d = DateTime.tryParse(s.updatedAt)?.toLocal();
  if (d == null) return '';
  return currentLang == Lang.en ? '${d.month}/${d.day}/${d.year}' : '${d.day}/${d.month}/${d.year}';
}

Component _processRow(Session p, bool first, void Function(String) onResume, void Function(String) onDelete) {
  final name = tl('process.name.${p.path.id}');
  return el('li', 'flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between', [
    el('div', 'min-w-0', [
      el('p', 'text-sm font-semibold text-foreground', [t(name)]),
      el('p', 'text-sm text-text-muted', [t(_resumeText(p))]),
      el('p', 'text-xs text-text-muted', [t(tl('process.updated', {'date': _date(p)}))]),
    ]),
    el('div', 'flex shrink-0 items-center gap-3', [
      // Solo el proceso más reciente lleva el color de "seguir": un único punto de mandarina en la pantalla.
      btn('${first ? 'btn-advance' : 'btn-primary'} px-5 py-2.5 text-sm', [t(tl('landing.resume.button'))], onClick: () => onResume(p.id)),
      el(
        'button',
        'text-sm text-text-muted underline underline-offset-2 transition hover:text-foreground',
        [t(tl('process.delete'))],
        attrs: {'type': 'button', 'aria-label': tl('process.deleteAria', {'name': name})},
        on: events(onClick: () => onDelete(p.id)),
      ),
    ]),
  ]);
}

Component landing({
  required void Function(CoachPath) onChoosePath,
  required List<Session> processes,
  required void Function(String) onResume,
  required void Function(String) onDelete,
}) {
  return el('section', 'py-16 md:py-24', [
    el('div', 'section-container', [
      when(processes.isNotEmpty, () => el('section', 'mx-auto mb-12 max-w-6xl rounded-2xl border border-primary/20 bg-card p-5', [
        el('h2', 'mb-1 text-base font-semibold text-foreground', [t(tl('process.title'))], id: 'mis-procesos'),
        el('p', 'mb-3 text-sm text-text-muted', [t(tl('process.lede'))]),
        el('ul', 'divide-y divide-border-color', [for (final (i, p) in processes.indexed) _processRow(p, i == 0, onResume, onDelete)]),
      ], attrs: {'aria-labelledby': 'mis-procesos'})),
      el('div', 'mx-auto mb-12 max-w-3xl text-center', [
        el('p', 'mb-4 text-xs font-semibold uppercase tracking-widest text-primary', [t(tl('landing.eyebrow'))]),
        el('h1', 'mb-5 leading-tight', [t(tl('landing.title'))]),
        el('p', 'mx-auto max-w-xl text-lg leading-relaxed text-text-muted', [
          t(tl('landing.lede')),
        ]),
      ]),
      el('div', 'mx-auto grid max-w-6xl gap-5 md:grid-cols-2 lg:grid-cols-3', [
        for (final p in _paths())
          el('div', 'card flex flex-col p-7', [
            el('div', 'mb-6 flex items-center justify-between', [
              el('span', 'rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary', [t(p.tag)]),
              el('span', 'flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-lg text-primary', [p.icon()], attrs: {'aria-hidden': 'true'}),
            ]),
            el('h2', 'mb-3 text-xl leading-snug', [t(p.title)]),
            el('p', '${p.note != null ? 'mb-3' : 'mb-8'} flex-1 text-sm leading-relaxed text-text-muted', [t(p.body)]),
            when(p.note != null, () => el('p', 'mb-5 text-xs font-semibold text-text-muted', [t(p.note!)])),
            // Mismo estilo en los dos: ningún camino se presenta como el recomendado.
            btn('btn-primary w-full py-3', [t(tl('landing.start'))], onClick: () => onChoosePath(p.path)),
          ]),
      ]),
      el('div', 'mx-auto mt-14 max-w-4xl', [
        el('div', 'glass-stage px-5 py-10 text-center sm:px-10 sm:py-12', [
          el('p', 'glass-kicker mb-7 text-xs font-semibold uppercase tracking-widest text-text-muted', [t(tl('landing.steps.title'))]),
          el('ol', 'flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-3', [
            for (final (i, s) in Stage.values.indexed)
              el('li', 'flex items-center gap-3', [
                el('span', 'glass-pill', [
                  el('span', 'glass-dot', [t('${i + 1}')], attrs: {'aria-hidden': 'true'}),
                  el('span', 'text-sm font-medium', [t(s == Stage.discovery ? tl('landing.steps.discovery') : s.label)]),
                ], attrs: {'style': 'animation-delay: ${(i * 1.1).toStringAsFixed(1)}s'}),
                when(i < 2, () => el('span', 'glass-link hidden h-px w-6 sm:block', [], attrs: {'aria-hidden': 'true'})),
              ]),
          ]),
          el('p', 'glass-pill glass-pill--quiet mt-8 text-sm', [t(tl('landing.steps.note'))]),
        ]),
      ]),
    ]),
  ], id: 'profesional');
}
