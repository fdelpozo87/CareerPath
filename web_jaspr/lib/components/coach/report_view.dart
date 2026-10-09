import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';
import 'package:universal_web/web.dart' as web;

import '../../models/types.dart';
import '../../ui.dart';

// Cierre del Plan de Acción: informe breve donde la persona selecciona qué acciones asume.
// Ninguna viene marcada por default.

const _bloqueLabel = {'70': '70 · Práctica', '20': '20 · Con otras personas', '10': '10 · Formación'};
const _tipoLabel = {'pedido': 'Pedido', 'oferta': 'Oferta'};

String _fecha(String iso) {
  final d = DateTime.tryParse(iso)?.toLocal();
  return d == null ? '' : '${d.day}/${d.month}/${d.year}';
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

  Component _action(int i, ReportAction a) => el('li', null, [
    el('label', 'flex gap-3 rounded-xl border border-border-color p-4 ${editing ? 'cursor-pointer hover:bg-secondary' : ''}', [
      when(editing, () => input<bool>(type: InputType.checkbox, checked: selected.contains(i), classes: 'mt-1 accent-primary print:hidden', onChange: (_) => _toggle(i))),
      el('div', 'flex-1', [
        el('p', 'text-sm font-medium leading-relaxed text-foreground', [t(a.texto)]),
        el('div', 'mt-2 flex flex-wrap gap-1.5 text-[11px]', [
          el('span', 'rounded-full bg-secondary px-2 py-0.5 text-text-muted', [t(_bloqueLabel[a.bloque] ?? a.bloque)]),
          if (_tipoLabel[a.tipo] != null) el('span', 'rounded-full bg-secondary px-2 py-0.5 font-semibold text-primary', [t(_tipoLabel[a.tipo]!)]),
          for (final c in a.cuatroC.where((c) => c.isNotEmpty)) el('span', 'rounded-full bg-secondary px-2 py-0.5 text-primary', [t('+ $c')]),
        ]),
        when(a.fortalezaAncla.isNotEmpty, () => el('p', 'mt-2 text-xs text-text-muted', [t('Se apoya en: ${a.fortalezaAncla}')])),
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
        el('p', 'mb-2 text-xs font-semibold uppercase tracking-widest text-text-muted', [t('Cierre del proceso')]),
        el('h2', 'mb-2', [t('Lo que construiste')]),
        el('p', 'text-sm text-text-muted', [t('No es un veredicto: es tu propia lectura, ordenada.')]),
      ]),
      el('div', 'flex flex-col gap-4', [
        el('div', 'card', [
          el('p', 'mb-2 text-xs font-semibold uppercase tracking-widest text-primary', [t('Objetivo de la sesión')]),
          el('p', 'text-sm leading-relaxed text-foreground', [t(report.objetivoSesion)]),
        ]),
        el('div', 'card', [
          el('p', 'mb-3 text-xs font-semibold uppercase tracking-widest text-text-muted', [t('Hallazgos')]),
          el('ul', 'space-y-3', [
            for (final h in report.hallazgos)
              el('li', 'text-sm leading-relaxed text-foreground', [
                t(h.texto),
                when(h.citaPersona.isNotEmpty, () => el('span', 'mt-1 block text-xs italic text-text-muted', [t('Vos dijiste: “${h.citaPersona}”')])),
              ]),
          ]),
        ]),
        el('div', 'card', [
          el('p', 'mb-1 text-xs font-semibold uppercase tracking-widest text-text-muted', [t(editing ? 'Acciones sugeridas' : 'Tus compromisos')]),
          el('p', 'mb-4 text-sm text-text-muted', [
            t(editing
                ? 'Salieron de la conversación. Marcá las que asumís como compromiso — no hace falta tomarlas todas.'
                : fecha != null && _fecha(fecha).isNotEmpty
                    ? 'Los elegiste el ${_fecha(fecha)}.'
                    : 'Los elegiste vos.'),
          ]),
          el('ul', 'space-y-3', [
            for (final (i, a) in report.acciones.indexed)
              if (editing || selected.contains(i)) _action(i, a),
          ]),
          when(editing && !hasPedido, () => el('p', 'mt-3 text-xs text-accent-ink', [
            t('Ninguna acción quedó como un pedido concreto a alguien. Si querés, volvé a pensarlo: ¿a quién le podrías pedir algo esta semana?'),
          ])),
        ]),
        el('div', 'grid gap-4 md:grid-cols-3', [
          _infoCard('Horizonte', report.horizonte),
          _infoCard('Cómo vas a saber que avanzás', report.metrica),
          _infoCard('Check-in', report.checkIn),
        ]),
        when(report.preguntaAbierta.isNotEmpty, () => el('div', 'ai-tint rounded-2xl p-6', [
          el('p', 'mb-2 text-xs font-semibold uppercase tracking-widest text-primary', [t('Para llevarte')]),
          el('p', 'italic leading-relaxed text-foreground', [t(report.preguntaAbierta)]),
        ], attrs: {'style': 'border-left: 3px solid var(--color-accent)'})),
      ]),
      el('div', 'mt-8 flex flex-wrap gap-3 print:hidden', [
        if (editing)
          btn('btn-primary flex-1 py-3.5 disabled:cursor-not-allowed disabled:opacity-40', [
            t('Asumir ${selected.isEmpty ? '' : selected.length} compromiso${selected.length == 1 ? '' : 's'} →'),
          ], disabled: selected.isEmpty, onClick: () {
            component.onSave([...selected]);
            setState(() => editing = false);
          })
        else ...[
          btn('btn-primary flex-1 py-3.5', [t('Imprimir / guardar PDF')], onClick: () => web.window.print()),
          btn('btn-secondary py-3.5', [t('Cambiar compromisos')], onClick: () => setState(() => editing = true)),
        ],
        btn('rounded-xl border border-border-color px-5 py-3.5 text-sm text-text-muted transition hover:bg-card', [t('Empezar de nuevo')], onClick: component.onRestart),
      ]),
      when(!editing, () => el('p', 'mt-4 text-center text-xs text-text-muted print:hidden', [t('Tus compromisos quedan guardados en este navegador: podés volver y retomar desde acá.')])),
    ]);
  }
}
