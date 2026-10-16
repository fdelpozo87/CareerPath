import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';
import 'package:universal_web/web.dart' as web;

import '../../i18n/i18n.dart';
import '../../models/docs.dart';
import '../../models/types.dart';
import '../../ui.dart';

// Carga de CV y perfil de LinkedIn. LinkedIn no se lee por URL (requiere login y sus condiciones
// prohíben el scraping): la persona exporta su propio perfil a PDF, que es gratis y controla qué comparte.

Component linkedInHowTo({bool compact = false}) => el('details', compact ? 'text-[11px] text-text-muted' : 'text-xs text-text-muted', [
  el('summary', 'cursor-pointer font-semibold text-primary underline-offset-2 hover:underline', [t(tl('docs.howto'))]),
  el('ol', 'mt-2 list-decimal space-y-1 pl-4 leading-relaxed', [
    el('li', null, [t(tl('docs.howto.1'))]),
    el('li', null, [t(tl('docs.howto.2'))]),
    el('li', null, [
      t(tl('docs.howto.3a')),
      el('strong', null, [t(tl('docs.howto.3b'))]),
      t(tl('docs.howto.3c')),
      el('strong', null, [t(tl('docs.howto.3d'))]),
      t(tl('docs.howto.3e')),
    ]),
    el('li', null, [
      t(tl('docs.howto.4a')),
      el('strong', null, [t(tl('docs.howto.4b'))]),
      t(tl('docs.howto.4c')),
      el('em', null, [t(tl('docs.howto.4d'))]),
      t(tl('docs.howto.4e')),
    ]),
  ]),
]);

class _SlotCopy {
  const _SlotCopy(this.title, this.desc, this.hint, this.placeholder);
  final String title;
  final String desc;
  final String hint;
  final String placeholder;
}

_SlotCopy _slotCopy(DocTipo tipo) => _SlotCopy(
  tl('docs.${tipo.id}.title'),
  tl('docs.${tipo.id}.desc'),
  tl('docs.${tipo.id}.hint'),
  tl('docs.${tipo.id}.placeholder'),
);

void _clickById(String id) => (web.document.getElementById(id) as web.HTMLElement?)?.click();

class DocSlot extends StatefulComponent {
  const DocSlot({required this.tipo, required this.draft, required this.onChange, super.key});
  final DocTipo tipo;
  final DocDraft draft;
  final void Function(DocDraft) onChange;

  @override
  State<DocSlot> createState() => _DocSlotState();
}

class _DocSlotState extends State<DocSlot> {
  String? error;

  void _handleFile(web.File f) {
    final err = checkPdf(f);
    setState(() => error = err);
    if (err == null) component.onChange(component.draft.copyWith(file: f));
  }

  @override
  Component build(BuildContext context) {
    final tipo = component.tipo;
    final draft = component.draft;
    final copy = _slotCopy(tipo);
    final inputId = 'file-${tipo.id}';

    return el('div', 'rounded-xl border border-border-color p-4', [
      el('div', 'mb-3 flex items-center justify-between gap-2', [
        el('div', null, [
          el('p', 'text-sm font-semibold text-foreground', [t(copy.title)]),
          el('p', 'text-xs text-text-muted', [t(copy.desc)]),
        ]),
        el('div', 'flex gap-1 text-xs', [
          for (final m in DocMode.values)
            el(
              'button',
              'rounded-full border px-2.5 py-1 transition ${draft.mode == m ? 'border-primary bg-secondary font-semibold text-primary' : 'border-border-color text-text-muted hover:bg-secondary'}',
              [t(m == DocMode.pdf ? tl('docs.mode.pdf') : tl('docs.mode.text'))],
              attrs: {'type': 'button', 'aria-pressed': '${draft.mode == m}'},
              on: events(onClick: () => component.onChange(draft.copyWith(mode: m))),
            ),
        ], attrs: {'role': 'group', 'aria-label': tl('docs.mode.group', {'what': copy.title.toLowerCase()})}),
      ]),
      if (draft.mode == DocMode.pdf) ...[
        // Botón real (no un div clickeable): recibe foco y se activa con Enter/Espacio.
        el(
          'button',
          'block w-full cursor-pointer rounded-lg border-2 border-dashed p-5 text-center transition',
          [
            if (draft.file != null)
              el('span', 'block text-sm font-semibold text-primary', [t('✓ ${draft.file!.name}')])
            else ...[
              el('span', 'block text-sm text-foreground', [t(tl('docs.drop'))]),
              el('span', 'mt-0.5 block text-xs text-text-muted', [t(copy.hint)]),
            ],
          ],
          attrs: {
            'type': 'button',
            'aria-label': draft.file != null
                ? tl('docs.fileLabel', {'title': copy.title, 'name': draft.file!.name})
                : tl('docs.pickLabel', {'title': copy.title}),
            'style': 'border-color: var(--color-${draft.file != null ? 'primary' : 'border-color'}); background: var(--color-${draft.file != null ? 'primary-soft' : 'card'})',
          },
          on: {
            'click': (_) => _clickById(inputId),
            'dragover': (e) => e.preventDefault(),
            'drop': (e) {
              e.preventDefault();
              final files = (e as web.DragEvent).dataTransfer?.files;
              if (files != null && files.length > 0) _handleFile(files.item(0)!);
            },
          },
        ),
        el('input', 'hidden', [], id: inputId, attrs: {'type': 'file', 'accept': '.pdf,application/pdf', 'tabindex': '-1', 'aria-hidden': 'true'}, on: {
          'change': (e) {
            final input = e.target as web.HTMLInputElement;
            final f = input.files?.item(0);
            input.value = '';
            if (f != null) _handleFile(f);
          },
        }),
      ] else
        el('textarea', 'w-full resize-y rounded-lg border border-border-color p-3 text-sm outline-none focus:border-primary', [t(draft.texto)],
            attrs: {'rows': '6', 'maxlength': '15000', 'placeholder': copy.placeholder},
            on: events<String>(onInput: (v) => component.onChange(draft.copyWith(texto: v)))),
      when(error != null, () => el('p', 'mt-2 text-xs text-danger', [t(error!)], attrs: {'role': 'alert'})),
      when(tipo == DocTipo.linkedin, () => el('div', 'mt-3', [linkedInHowTo()])),
    ]);
  }
}

/// Panel del chat: sumar CV y/o LinkedIn en cualquier momento del proceso.
class DocsPanel extends StatefulComponent {
  const DocsPanel({required this.docs, required this.status, required this.onAttach, super.key});
  final List<ProfileDoc> docs;
  final String? status;
  final void Function(DocTipo, web.File) onAttach;

  @override
  State<DocsPanel> createState() => _DocsPanelState();
}

class _DocsPanelState extends State<DocsPanel> {
  DocTipo pending = DocTipo.cv;
  String? error;

  @override
  Component build(BuildContext context) {
    final faltan = [for (final tp in DocTipo.values) if (!component.docs.any((d) => d.tipo == tp)) tp];
    return el('div', 'space-y-2', [
      el('p', 'text-sm leading-relaxed text-foreground', [t(tl('docs.panel.intro'))]),
      for (final d in component.docs) el('p', 'text-xs text-text-muted', [t(tl('docs.panel.added', {'kind': d.tipo.label, 'name': d.nombre}))]),
      if (component.status != null)
        el('p', 'text-xs text-text-muted', [t(component.status!)])
      else if (faltan.isNotEmpty) ...[
        el('div', 'flex flex-wrap gap-x-3 gap-y-1', [
          for (final tp in faltan)
            btn('text-xs font-semibold text-primary underline underline-offset-2', [t(tp == DocTipo.cv ? tl('docs.panel.addCv') : tl('docs.panel.addLinkedin'))], onClick: () {
              setState(() => pending = tp);
              _clickById('file-panel');
            }),
        ]),
        el('input', 'hidden', [], id: 'file-panel', attrs: {'type': 'file', 'accept': '.pdf,application/pdf'}, on: {
          'change': (e) {
            final input = e.target as web.HTMLInputElement;
            final f = input.files?.item(0);
            input.value = '';
            if (f == null) return;
            final err = checkPdf(f);
            setState(() => error = err);
            if (err == null) component.onAttach(pending, f);
          },
        }),
        when(faltan.contains(DocTipo.linkedin), () => linkedInHowTo(compact: true)),
      ],
      when(error != null, () => el('p', 'text-xs text-danger', [t(error!)], attrs: {'role': 'alert'})),
      el('p', 'pt-1 text-[11px] leading-snug text-text-muted', [t(tl('docs.panel.note'))]),
    ]);
  }
}
