import 'package:jaspr/jaspr.dart';

import '../ui.dart';

// Marca de Bivio: dos puntos conectados por trazos que forman una V (el momento de elegir entre
// dos caminos), con la palabra "bivio" (bifurcación, en italiano). Un solo color: el burdeos de la marca.

Component _circle(String cx) => el('circle', null, [], attrs: {'cx': cx, 'cy': '55.5', 'r': '31.5'});
Component _path(String d) => el('path', null, [], attrs: {'d': d});

/// El símbolo solo.
Component bivioMark(String classes) => el(
  'svg',
  classes,
  [
    _circle('78.5'),
    _circle('257'),
    _path('M69 96.5h20.5c13.3 0 23.8 6.4 30.8 17.4l73.8 111.3c6.8 10.2 2.9 22.6-7.9 29.2-11.1 6.8-25.4 4.4-33.3-7.3L55.5 121.4c-8.5-12.8-1.4-24.9 13.5-24.9Z'),
    _path('M247.5 96.5h20.2c14.6 0 20.4 11.7 12.2 24.3l-76.5 116.8-31.7-47.8 44.8-68.2c7.5-11.4 17.5-15.1 31-15.1Z'),
  ],
  attrs: {'viewBox': '0 0 342 302', 'fill': '#781633', 'aria-hidden': 'true'},
);

/// Avatar del coach: aparece junto a cada mensaje y en el encabezado del chat.
Component coachAvatar({bool small = false}) => el(
  'span',
  'flex ${small ? 'h-8 w-8' : 'h-10 w-10'} shrink-0 items-center justify-center rounded-full bg-primary-soft',
  [bivioMark(small ? 'h-4' : 'h-5')],
  attrs: {'aria-hidden': 'true'},
);

Component logo([String extra = '']) => el('span', 'inline-flex items-center gap-2.5 $extra', [
  bivioMark('h-8'),
  el('span', 'text-2xl font-medium leading-none tracking-tight text-foreground', [t('bivio')]),
]);
