import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';
import 'package:universal_web/web.dart' as web;

import '../../i18n/i18n.dart';
import '../../models/types.dart';
import '../../ui.dart';

// Cierre del Plan de Acción: informe breve donde la persona selecciona qué acciones asume.
// Ninguna viene marcada por default.

String _bloqueLabel(String b) => const {'70', '20', '10'}.contains(b) ? tl('report.block.$b') : b;
String? _tipoLabel(String t) => const {'pedido', 'oferta'}.contains(t) ? tl('report.type.$t') : null;

String _fecha(String iso) {
  final d = DateTime.tryParse(iso)?.toLocal();
  if (d == null) return '';
  return currentLang == Lang.en ? '${d.month}/${d.day}/${d.year}' : '${d.day}/${d.month}/${d.year}';
}

class ReportView extends StatefulComponent {
  const ReportView({required this.report, required this.compromisos, required this.compromisosFecha, required this.onSave, required this.onRestart, super.key});
  final Report report;
  final List<int>? compromisos;
  final String? compromisosFecha;
  final void Function(List<int>) onSave;
  final void Function() onRestart;

  @override
  State<ReportView> createState() => _ReportViewState();
}

class _ReportViewState extends State<ReportView> {
  late List<int> selected = [...?component.compromisos];
  late bool editing = component.compromisos == null;

  void _toggle(int i) => setState(() => selected.contains(i) ? selected.remove(i) : selected.add(i));

  Component _infoCard(String title, String body) => el('div', 'card p-5', [
    el('p', 'mb-2 text-xs font-semibold uppercase tracking-widest text-text-muted', [t(title)]),
    el('p', 'text-sm leading-relaxed text-foreground', [t(body)]),
  ]);

  Component _comparison(Comparison c) => el('div', 'card', [
    el('p', 'mb-1 text-xs font-semibold uppercase tracking-widest text-text-muted', [t(tl('report.compare.title'))]),
    el('p', 'mb-4 text-sm text-text-muted', [t(tl('report.compare.lede'))]),
    when(c.criterios.isNotEmpty, () => el('ol', 'mb-4 list-decimal space-y-1 pl-5 text-sm text-foreground', [
      for (final k in c.criterios) el('li', null, [t(k)]),
    ])),
    el('ul', 'space-y-3', [
      for (final o in c.opciones)
        el('li', 'rounded-xl border border-border-color p-4 text-sm leading-relaxed', [
          el('p', 'font-semibold text-foreground', [t(o.nombre)]),
          when(o.aFavor.isNotEmpty, () => el('p', 'mt-1 text-foreground', [el('span', 'font-semibold text-primary', [t(tl('report.compare.pro'))]), t(' ${o.aFavor}')])),
          when(o.enContra.isNotEmpty, () => el('p', 'mt-1 text-foreground', [el('span', 'font-semibold text-accent-ink', [t(tl('report.compare.con'))]), t(' ${o.enContra}')])),
          when(o.falta.isNotEmpty, () => el('p', 'mt-1 text-text-muted', [el('span', 'font-semibold', [t(tl('report.compare.missing'))]), t(' ${o.falta}')])),
        ]),
    ]),
    el('p', 'mt-3 text-xs text-text-muted', [
      t(tl('report.compare.disclaimer')),
    ]),
  ]);

  Component _action(int i, ReportAction a) => el('li', null, [
    el('label', 'flex gap-3 rounded-xl border p-4 ${editing ? 'cursor-pointer hover:bg-secondary' : ''} ${editing && selected.contains(i) ? 'border-accent bg-accent-soft' : 'border-border-color'}', [
      when(editing, () => input<bool>(type: InputType.checkbox, checked: selected.contains(i), classes: 'mt-1 accent-primary print:hidden', onChange: (_) => _toggle(i))),
      el('div', 'flex-1', [
        el('p', 'text-sm font-medium leading-relaxed text-foreground', [t(a.texto)]),
        el('div', 'mt-2 flex flex-wrap gap-1.5 text-[11px]', [
          el('span', 'rounded-full bg-secondary px-2 py-0.5 text-text-muted', [t(_bloqueLabel(a.bloque))]),
          if (_tipoLabel(a.tipo) != null) el('span', 'rounded-full bg-secondary px-2 py-0.5 font-semibold text-primary', [t(_tipoLabel(a.tipo)!)]),
          for (final c in a.cuatroC.where((c) => c.isNotEmpty)) el('span', 'rounded-full bg-secondary px-2 py-0.5 text-primary', [t('+ $c')]),
        ]),
        when(a.fortalezaAncla.isNotEmpty, () => el('p', 'mt-2 text-xs text-text-muted', [t(tl('report.basedOn', {'what': a.fortalezaAncla}))])),
      ]),
    ]),
  ]);

  @override
  Component build(BuildContext context) {
    final report = component.report;
    final hasPedido = report.acciones.any((x) => x.tipo == 'pedido');
    final fecha = component.compromisosFecha;

    return el('div', 'ai-result mx-auto max-w-2xl', [
      el('div', 'mb-8 text-center', [
        el('p', 'mb-2 text-xs font-semibold uppercase tracking-widest text-text-muted', [t(tl('report.eyebrow'))]),
        el('h2', 'mb-2', [t(tl('report.title'))]),
        el('p', 'text-sm text-text-muted', [t(tl('report.lede'))]),
      ]),
      el('div', 'flex flex-col gap-4', [
        el('div', 'card', [
          el('p', 'mb-2 text-xs font-semibold uppercase tracking-widest text-primary', [t(tl('report.objective'))]),
          el('p', 'text-sm leading-relaxed text-foreground', [t(report.objetivoSesion)]),
        ]),
        el('div', 'card', [
          el('p', 'mb-3 text-xs font-semibold uppercase tracking-widest text-text-muted', [t(tl('report.findings'))]),
          el('ul', 'space-y-3', [
            for (final h in report.hallazgos)
              el('li', 'text-sm leading-relaxed text-foreground', [
                t(h.texto),
                when(h.citaPersona.isNotEmpty, () => el('span', 'mt-1 block text-xs italic text-text-muted', [t(tl('report.saidQuote', {'quote': h.citaPersona}))])),
              ]),
          ]),
        ]),
        el('div', 'card', [
          el('p', 'mb-1 text-xs font-semibold uppercase tracking-widest text-text-muted', [t(editing ? tl('report.suggested') : tl('report.commitments'))]),
          el('p', 'mb-4 text-sm text-text-muted', [
            t(editing
                ? tl('report.pick')
                : fecha != null && _fecha(fecha).isNotEmpty
                    ? tl('report.chosenOn', {'date': _fecha(fecha)})
                    : tl('report.chosenBy')),
          ]),
          el('ul', 'space-y-3', [
            for (final (i, a) in report.acciones.indexed)
              if (editing || selected.contains(i)) _action(i, a),
          ]),
          when(editing && !hasPedido, () => el('p', 'mt-3 text-xs text-accent-ink', [
            t(tl('report.noRequest')),
          ])),
        ]),
        el('div', 'grid gap-4 md:grid-cols-3', [
          _infoCard(tl('report.horizon'), report.horizonte),
          _infoCard(tl('report.metric'), report.metrica),
          _infoCard(tl('report.checkin'), report.checkIn),
        ]),
        when(report.presupuesto.isNotEmpty || report.respaldo.isNotEmpty, () => el('div', 'grid gap-4 md:grid-cols-2', [
          when(report.presupuesto.isNotEmpty, () => _infoCard(tl('report.budget'), report.presupuesto)),
          when(report.respaldo.isNotEmpty, () => _infoCard(tl('report.planB'), report.respaldo)),
        ])),
        when(report.comparativa != null && (report.comparativa!.criterios.isNotEmpty || report.comparativa!.opciones.isNotEmpty), () => _comparison(report.comparativa!)),
        when(report.faltaParaCompletar.isNotEmpty, () => el('div', 'card', [
          el('p', 'mb-1 text-xs font-semibold uppercase tracking-widest text-text-muted', [t(tl('report.gaps.title'))]),
          el('p', 'mb-3 text-sm text-text-muted', [t(tl('report.gaps.lede'))]),
          el('ul', 'list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-foreground', [for (final g in report.faltaParaCompletar) el('li', null, [t(g)])]),
        ])),
        when(report.preguntaAbierta.isNotEmpty, () => el('div', 'ai-tint rounded-2xl p-6', [
          el('p', 'mb-2 text-xs font-semibold uppercase tracking-widest text-primary', [t(tl('report.take'))]),
          el('p', 'italic leading-relaxed text-foreground', [t(report.preguntaAbierta)]),
        ], attrs: {'style': 'border-left: 3px solid var(--color-accent)'})),
      ]),
      el('div', 'mt-8 flex flex-wrap gap-3 print:hidden', [
        if (editing)
          btn('btn-primary flex-1 py-3.5 disabled:cursor-not-allowed disabled:opacity-40', [
            t(selected.isEmpty ? tl('report.take.zero') : tln('report.take.n', selected.length)),
          ], disabled: selected.isEmpty, onClick: () {
            component.onSave([...selected]);
            setState(() => editing = false);
          })
        else ...[
          btn('btn-primary flex-1 py-3.5', [t(tl('report.print'))], onClick: () => web.window.print()),
          btn('btn-secondary py-3.5', [t(tl('report.edit'))], onClick: () => setState(() => editing = true)),
        ],
        btn('rounded-xl border border-border-color px-5 py-3.5 text-sm text-text-muted transition hover:bg-card', [t(tl('report.restart'))], onClick: component.onRestart),
      ]),
      when(!editing, () => el('p', 'mt-4 text-center text-xs text-text-muted print:hidden', [t(tl('report.saved'))])),
    ]);
  }
}
