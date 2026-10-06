import 'package:jaspr/jaspr.dart';

import '../../models/stages.dart';
import '../../models/types.dart';
import '../../ui.dart';

// Cierre de cada etapa: el "mapa" de lo que la persona fue diciendo, con sus propias frases. Se ve
// de un vistazo qué se construyó, y la persona puede ajustarlo antes de seguir (apropiación).

Component stageMap({
  required Stage stage,
  required StageMap? map,
  required String? fallbackText,
  required String nextLabel,
  required void Function() onAdvance,
  required void Function() onAdjust,
  required void Function(String id) onResume,
}) {
  String labelOf(String id) => stageObjectives[stage]!.where((o) => o.id == id).firstOrNull?.label ?? id;
  final titleId = 'mapa-${stage.id}';

  return el('section', 'ai-result rounded-3xl border border-primary/20 bg-primary-soft/40 p-5 sm:p-6', [
    el('p', 'mb-1 text-xs font-semibold uppercase tracking-widest text-primary', [t('Lo que fuimos armando')]),
    el('h2', 'mb-1 text-2xl', [t(stageIntro[stage]!.titulo)], id: titleId),
    el('p', 'mb-5 text-sm leading-relaxed text-text-muted', [t('Esto es lo que dijiste, ordenado. Si algo no te representa, escribilo abajo y lo ajustamos antes de seguir.')]),
    if (map != null && map.items.isNotEmpty)
      el('ul', 'grid gap-3 sm:grid-cols-2', [
        for (final item in map.items)
          if (item.omitido)
            // Un tema que la persona eligió dejar para después: se muestra tal cual es, sin inventarle contenido.
            el('li', 'rounded-2xl border border-dashed border-text-muted/50 bg-transparent p-4', [
              el('p', 'mb-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted', [t(labelOf(item.id))]),
              el('p', 'text-[15px] leading-relaxed text-text-muted', [t('Lo dejaste para más adelante. Cuando quieras, lo retomamos.')]),
              btn('mt-3 text-sm font-semibold text-primary underline underline-offset-2', [t('Retomarlo ahora')], onClick: () => onResume(item.id)),
            ])
          else
            el('li', 'rounded-2xl border border-border-color bg-card p-4', [
              el('p', 'mb-1.5 text-xs font-semibold uppercase tracking-wider text-primary', [t(labelOf(item.id))]),
              el('p', 'text-[15px] leading-relaxed text-foreground', [t(item.texto)]),
              when(item.cita.isNotEmpty, () => el('blockquote', 'mt-3 border-l-2 border-accent pl-3 text-sm italic leading-relaxed text-text-muted', [
                el('span', 'sr-only', [t('Vos dijiste: ')]),
                t('“${item.cita}”'),
              ])),
            ]),
      ], attrs: {'role': 'list'})
    else if (fallbackText != null && fallbackText.isNotEmpty)
      el('p', 'whitespace-pre-wrap rounded-2xl border border-border-color bg-card p-4 text-[15px] leading-relaxed', [t(fallbackText)]),
    when(map != null && map.pregunta.isNotEmpty, () => el('div', 'mt-4 rounded-2xl bg-accent-soft p-4', [
      el('p', 'mb-1 text-xs font-semibold uppercase tracking-wider text-accent-ink', [t('Una pregunta para llevarte')]),
      el('p', 'font-display text-lg leading-snug text-foreground', [t(map!.pregunta)]),
    ])),
    el('div', 'mt-5 flex flex-wrap items-center gap-3', [
      btn('btn-primary px-6 py-3 text-sm', [t(nextLabel)], onClick: onAdvance),
      btn('btn-secondary px-5 py-3 text-sm', [t('Quiero ajustar algo')], onClick: onAdjust),
    ]),
  ], id: 'stage-map', attrs: {'aria-labelledby': titleId});
}
