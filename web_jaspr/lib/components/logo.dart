import 'package:jaspr/jaspr.dart';

import '../ui.dart';

// Marca de Bivio: un trazo que se bifurca en dos caminos (el momento de elegir), con la palabra
// "bivio" (bifurcación, en italiano). Los verdes son los del logo original.

Component _line(String x1, String y1, String x2, String y2, String stroke) =>
    el('line', null, [], attrs: {'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2, 'stroke': stroke});

/// El símbolo solo: una rama gruesa que se abre en dos, con un punto lleno y uno vacío.
Component bivioMark(String classes) => el(
  'svg',
  classes,
  [
    _line('170', '300', '170', '210', '#0F6E56'),
    _line('170', '210', '260', '120', '#0F6E56'),
    _line('170', '210', '260', '300', '#1D9E75'),
    el('circle', null, [], attrs: {'cx': '260', 'cy': '120', 'r': '16', 'fill': '#0F6E56', 'stroke': 'none'}),
    el('circle', null, [], attrs: {'cx': '260', 'cy': '300', 'r': '14', 'stroke': '#1D9E75', 'stroke-width': '7'}),
  ],
  attrs: {
    'viewBox': '156 100 128 224',
    'fill': 'none',
    'stroke-width': '18',
    'stroke-linecap': 'round',
    'aria-hidden': 'true',
  },
);

/// Avatar del coach: aparece junto a cada mensaje y en el encabezado del chat.
Component coachAvatar({bool small = false}) => el(
  'span',
  'flex ${small ? 'h-8 w-8' : 'h-10 w-10'} shrink-0 items-center justify-center rounded-full bg-primary-soft',
  [bivioMark(small ? 'h-5' : 'h-6')],
  attrs: {'aria-hidden': 'true'},
);

Component logo([String extra = '']) => el('span', 'inline-flex items-center gap-2.5 $extra', [
  bivioMark('h-9'),
  el('span', 'text-2xl font-medium leading-none tracking-tight text-foreground', [t('bivio')]),
]);
