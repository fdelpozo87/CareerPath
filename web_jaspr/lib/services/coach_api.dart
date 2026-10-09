import 'dart:convert';
import 'dart:js_interop';

import 'package:universal_web/web.dart' as web;

import '../models/types.dart';
import 'http.dart';

// Cliente de /api/coach (server/coach.ts). El system prompt y la API key viven del lado del
// servidor: acá solo se arma el historial.

const _maxHistory = 100;
const maxPdfBytes = 3 * 1024 * 1024;

class CoachResponse<T> {
  const CoachResponse(this.data, this.demo);
  final T data;
  final bool demo;
}

Future<CoachResponse<Map<String, dynamic>>> _post(Map<String, Object?> payload) async {
  final json = await postJson('/api/coach', payload);
  final data = json['data'];
  if (data is! Map<String, dynamic>) throw ApiException('No pudimos conectar con el coach. Intentá de nuevo.');
  return CoachResponse(data, json['demo'] == true);
}

List<Map<String, String>> _toHistory(List<UiMessage> messages) {
  final history = [
    for (final m in messages) {'role': m.role, 'text': m.isUser ? m.text : (m.raw ?? m.text)},
  ];
  // Conserva el mensaje de apertura y el tramo más reciente.
  return history.length > _maxHistory ? [history.first, ...history.sublist(history.length - (_maxHistory - 1))] : history;
}

String? _perfilContext(Session s) {
  final p = s.perfil;
  if (p == null) return null;
  final recs = [
    for (var i = 0; i < p.lectura.recomendaciones.length; i++)
      '- ${p.lectura.recomendaciones[i].cambio}${p.elegidas.contains(i) ? ' [la persona eligió tomarla]' : ' [la persona no la eligió]'}',
  ].join('\n');
  return 'Puesto al que apunta: ${p.puesto}\n'
      'Primera impresión: ${p.lectura.primeraImpresion}\n'
      'Consistencia de marca: ${p.lectura.consistenciaMarca}\n'
      'Nota ${p.lectura.nota}/10 — ${p.lectura.notaComunica} (mide qué comunica el perfil, no cuánto vale la persona)\n'
      'Recomendaciones:\n$recs';
}

/// Une los documentos bajo encabezados, para que el modelo sepa de cuál sale cada cita.
String? documentsToText(List<ProfileDoc> docs) {
  if (docs.isEmpty) return null;
  return docs.map((d) => '${d.tipo == DocTipo.cv ? '=== CV ===' : '=== LINKEDIN ==='}\n${d.texto.trim()}').join('\n\n');
}

Map<String, Object?> _shared(Session s) => {
  'path': s.path.id,
  'history': _toHistory(s.messages),
  'sintesisPrevias': {for (final e in s.sintesis.entries) e.key.id: e.value},
  // Los opcionales se omiten (el servidor acepta el campo ausente, no null).
  if (documentsToText(s.documentos) case final docs?) 'documentos': docs,
  if (_perfilContext(s) case final perfil?) 'lecturaPerfil': perfil,
};

Future<CoachResponse<TurnResult>> requestTurn(Session s) async {
  final r = await _post({
    'mode': 'turno',
    'stage': s.stage.id,
    'cubiertos': s.cubiertos[s.stage] ?? const <String>[],
    'etapaCerrada': s.stageReady,
    'omitidos': s.omitidos[s.stage] ?? const <String>[],
    ..._shared(s),
  });
  return CoachResponse(TurnResult.fromJson(r.data), r.demo);
}

Future<Report> requestReport(Session s) async => Report.fromJson((await _post({'mode': 'informe', ..._shared(s)})).data);

Future<ProfileReading> requestProfileReading(String puesto, String perfilTexto) async =>
    ProfileReading.fromJson((await _post({'mode': 'perfil', 'puesto': puesto, 'perfilTexto': perfilTexto})).data);

/// Lee el PDF en el navegador y le pide al servidor que extraiga el texto.
Future<String> extractPdfText(web.File file) async {
  final bytes = (await file.arrayBuffer().toDart).toDart.asUint8List();
  final r = await _post({'mode': 'extraer', 'pdfBase64': base64Encode(bytes)});
  return (r.data['texto'] as String?) ?? '';
}
