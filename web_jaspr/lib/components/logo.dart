import 'package:jaspr/jaspr.dart';

import '../ui.dart';

// Marca de CareerPath: la brújula en un círculo verde, como en el diseño del equipo.

Component compass(String classes) => el(
  'svg',
  classes,
  [
    el('circle', null, [], attrs: {'cx': '12', 'cy': '12', 'r': '8.5'}),
    el('path', null, [], attrs: {'d': 'm15.6 8.4-2 5.2-5.2 2 2-5.2 5.2-2Z'}),
  ],
  attrs: {
    'viewBox': '0 0 24 24',
    'fill': 'none',
    'stroke': 'currentColor',
    'stroke-width': '1.7',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
  },
);

/// Avatar del coach: aparece junto a cada mensaje y en el encabezado del chat.
Component coachAvatar({bool small = false}) => el(
  'span',
  'flex ${small ? 'h-8 w-8' : 'h-10 w-10'} shrink-0 items-center justify-center rounded-full bg-primary text-white',
  [compass(small ? 'h-[18px] w-[18px]' : 'h-5 w-5')],
  attrs: {'aria-hidden': 'true'},
);

Component logo([String extra = '']) => el('span', 'inline-flex items-center gap-2.5 $extra', [
  coachAvatar(small: true),
  el('span', 'font-display text-xl font-medium tracking-tight text-foreground', [t('CareerPath')]),
]);
