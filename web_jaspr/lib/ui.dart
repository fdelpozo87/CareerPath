import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';

// Atajos para escribir el marcado casi igual que el JSX de la versión React: el primer argumento
// son las clases de Tailwind y el segundo los hijos.

/// Elemento HTML/SVG genérico: `el('div', 'flex gap-2', [t('hola')], attrs: {...}, on: {...})`.
Component el(
  String tag,
  String? classes,
  List<Component> children, {
  String? id,
  Map<String, String>? attrs,
  Map<String, EventCallback>? on,
}) => Component.element(tag: tag, id: id, classes: classes, attributes: attrs, events: on, children: children);

Component t(String text) => Component.text(text);

/// Renderiza [child] solo si [cond] es verdadera.
Component when(bool cond, Component Function() child) => cond ? child() : const Component.empty();

/// Botón con manejador de click. [type] es 'button' salvo que sea de formulario.
Component btn(
  String classes,
  List<Component> children, {
  required void Function() onClick,
  String type = 'button',
  bool disabled = false,
  String? id,
  Map<String, String>? attrs,
}) => el(
  'button',
  classes,
  children,
  id: id,
  attrs: {'type': type, if (disabled) 'disabled': '', ...?attrs},
  on: events(onClick: onClick),
);

/// Enlace. Los externos se abren en otra pestaña sin pasar el referer.
Component anchor(String classes, String href, List<Component> children, {bool external = false}) => el(
  'a',
  classes,
  children,
  attrs: {'href': href, if (external) ...{'target': '_blank', 'rel': 'noopener noreferrer'}},
);
