import 'package:jaspr/jaspr.dart';

import '../i18n/i18n.dart';
import '../ui.dart';
import 'account_menu.dart';
import 'language_toggle.dart';
import 'logo.dart';
import 'theme_toggle.dart';

const _navLink = 'text-sm text-text-muted transition-colors hover:text-foreground';
const _footLink = 'transition-colors hover:text-foreground';

Component siteHeader(AccountInfo account) => el('header', 'sticky top-0 z-50 border-b border-border-color bg-background/90 backdrop-blur-sm', [
  el('div', 'section-container flex items-center justify-between py-4', [
    logo(),
    el('div', 'flex items-center gap-8', [
      el('nav', 'hidden gap-8 md:flex', [
        anchor(_navLink, '#profesional', [t(tl('nav.professionals'))]),
        anchor(_navLink, '#empresa', [t(tl('nav.companies'))]),
      ]),
      el('div', 'flex items-center gap-2', [languageToggle(), const ThemeToggle(), AccountMenu(account: account)]),
    ]),
  ]),
]);

Component siteFooter() => el('footer', 'border-t border-border-color py-10 md:py-14', [
  el('div', 'section-container', [
    el('div', 'mb-10 grid gap-8 text-sm md:grid-cols-3', [
      el('div', null, [
        logo('mb-3'),
        el('p', 'text-text-muted', [t(tl('footer.tagline'))]),
      ]),
      el('div', null, [
        el('p', 'mb-3 font-medium text-foreground', [t(tl('footer.links'))]),
        el('ul', 'space-y-2 text-text-muted', [
          el('li', null, [anchor(_footLink, '#', [t(tl('footer.home'))])]),
          el('li', null, [anchor(_footLink, '#profesional', [t(tl('nav.professionals'))])]),
          el('li', null, [anchor(_footLink, '#empresa', [t(tl('nav.companies'))])]),
          el('li', null, [anchor(_footLink, '#privacidad', [t(tl('footer.privacy'))])]),
        ]),
      ]),
      el('div', null, [
        el('p', 'mb-3 font-medium text-foreground', [t(tl('footer.rubika'))]),
        el('ul', 'space-y-2 text-text-muted', [
          el('li', null, [anchor(_footLink, 'https://rubikanetworking.com', [t(tl('footer.web'))], external: true)]),
          el('li', null, [anchor(_footLink, 'https://linkedin.com/company/rubika-networking', [t('LinkedIn')], external: true)]),
        ]),
      ]),
    ]),
    el('div', 'border-t border-border-color pt-5 text-center text-xs text-text-muted', [
      t(tl('footer.copyright')),
    ]),
  ]),
]);
