import 'package:jaspr/jaspr.dart';

import '../ui.dart';
import 'account_menu.dart';
import 'logo.dart';

const _navLink = 'text-sm text-text-muted transition-colors hover:text-foreground';
const _footLink = 'transition-colors hover:text-foreground';

Component siteHeader(AccountInfo account) => el('header', 'sticky top-0 z-50 border-b border-border-color bg-background/90 backdrop-blur-sm', [
  el('div', 'section-container flex items-center justify-between py-4', [
    logo(),
    el('div', 'flex items-center gap-8', [
      el('nav', 'hidden gap-8 md:flex', [
        anchor(_navLink, '#profesional', [t('Para Profesionales')]),
        anchor(_navLink, '#empresa', [t('Para Empresas')]),
      ]),
      AccountMenu(account: account),
    ]),
  ]),
]);

Component siteFooter() => el('footer', 'border-t border-border-color py-10 md:py-14', [
  el('div', 'section-container', [
    el('div', 'mb-10 grid gap-8 text-sm md:grid-cols-3', [
      el('div', null, [
        logo('mb-3'),
        el('p', 'text-text-muted', [t('Tu próximo paso de carrera, pensado con vos.')]),
      ]),
      el('div', null, [
        el('p', 'mb-3 font-medium text-foreground', [t('Links')]),
        el('ul', 'space-y-2 text-text-muted', [
          el('li', null, [anchor(_footLink, '#', [t('Inicio')])]),
          el('li', null, [anchor(_footLink, '#profesional', [t('Para Profesionales')])]),
          el('li', null, [anchor(_footLink, '#empresa', [t('Para Empresas')])]),
          el('li', null, [anchor(_footLink, '#privacidad', [t('Privacidad y términos')])]),
        ]),
      ]),
      el('div', null, [
        el('p', 'mb-3 font-medium text-foreground', [t('Rubika')]),
        el('ul', 'space-y-2 text-text-muted', [
          el('li', null, [anchor(_footLink, 'https://rubikanetworking.com', [t('Web')], external: true)]),
          el('li', null, [anchor(_footLink, 'https://linkedin.com/company/rubika-networking', [t('LinkedIn')], external: true)]),
        ]),
      ]),
    ]),
    el('div', 'border-t border-border-color pt-5 text-center text-xs text-text-muted', [
      t('© 2026 Bivio by Rubika Tech. Todos los derechos reservados.'),
    ]),
  ]),
]);
