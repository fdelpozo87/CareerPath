import 'package:universal_web/web.dart' as web;

import '../i18n/i18n.dart';
import '../services/coach_api.dart' show maxPdfBytes;

// Borrador de un documento (CV o LinkedIn) mientras la persona lo carga.

enum DocMode { pdf, texto }

class DocDraft {
  const DocDraft({this.mode = DocMode.pdf, this.file, this.texto = ''});
  final DocMode mode;
  final web.File? file;
  final String texto;

  DocDraft copyWith({DocMode? mode, web.File? file, String? texto}) =>
      DocDraft(mode: mode ?? this.mode, file: file ?? this.file, texto: texto ?? this.texto);

  bool get ready => mode == DocMode.pdf ? file != null : texto.trim().length >= 80;
}

/// Valida un PDF; devuelve un mensaje de error o null.
String? checkPdf(web.File f) {
  if (!(f.type == 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))) return tl('docs.err.type');
  if (f.size > maxPdfBytes) return tl('docs.err.size');
  return null;
}
