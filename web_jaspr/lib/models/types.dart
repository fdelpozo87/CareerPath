import 'stages.dart';

// Modelos del coach. toJson/fromJson conservan la forma del JSON de la versión React
// (clave de sesión cp_coach_session_v2), así una sesión guardada sigue siendo válida.

List<String> _strings(Object? v) => [for (final e in (v as List? ?? const [])) e.toString()];
String _str(Object? v) => v is String ? v : '';

/// Una pieza del "mapa" con el que cierra cada etapa.
class SynthesisItem {
  const SynthesisItem({required this.id, required this.texto, required this.cita, this.omitido = false});
  final String id;
  final String texto;
  final String cita;
  final bool omitido;

  factory SynthesisItem.fromJson(Map<String, dynamic> j) =>
      SynthesisItem(id: _str(j['id']), texto: _str(j['texto']), cita: _str(j['cita']), omitido: j['omitido'] == true);

  Map<String, dynamic> toJson() => {'id': id, 'texto': texto, 'cita': cita, if (omitido) 'omitido': true};
}

class StageMap {
  const StageMap({required this.items, required this.pregunta});
  final List<SynthesisItem> items;
  final String pregunta;

  factory StageMap.fromJson(Map<String, dynamic> j) => StageMap(
    items: [for (final i in (j['items'] as List? ?? const [])) SynthesisItem.fromJson(i as Map<String, dynamic>)],
    pregunta: _str(j['pregunta']),
  );

  Map<String, dynamic> toJson() => {'items': [for (final i in items) i.toJson()], 'pregunta': pregunta};
}

class TurnResult {
  const TurnResult({
    required this.mensaje,
    required this.temaEnFoco,
    required this.temasOmitidos,
    required this.objetivosCubiertos,
    required this.listoParaAvanzar,
    required this.derivacion,
    required this.sintesisEtapa,
    required this.sintesisItems,
    required this.preguntaPuente,
  });
  final String mensaje;
  final String temaEnFoco;
  final List<String> temasOmitidos;
  final List<String> objetivosCubiertos;
  final bool listoParaAvanzar;
  final bool derivacion;
  final String sintesisEtapa;
  final List<SynthesisItem> sintesisItems;
  final String preguntaPuente;

  factory TurnResult.fromJson(Map<String, dynamic> j) => TurnResult(
    mensaje: _str(j['mensaje']),
    temaEnFoco: _str(j['temaEnFoco']),
    temasOmitidos: _strings(j['temasOmitidos']),
    objetivosCubiertos: _strings(j['objetivosCubiertos']),
    listoParaAvanzar: j['listoParaAvanzar'] == true,
    derivacion: j['derivacion'] == true,
    sintesisEtapa: _str(j['sintesisEtapa']),
    sintesisItems: [for (final i in (j['sintesisItems'] as List? ?? const [])) SynthesisItem.fromJson(i as Map<String, dynamic>)],
    preguntaPuente: _str(j['preguntaPuente']),
  );
}

class UiMessage {
  const UiMessage({
    required this.role,
    required this.text,
    required this.stage,
    this.raw,
    this.hidden = false,
    this.derivacion = false,
    this.cierraEtapa = false,
  });

  /// 'user' | 'model'
  final String role;
  final String text;

  /// Turnos del modelo: el JSON crudo, que se reenvía como historial.
  final String? raw;

  /// Mensajes de control (inicio de etapa) que no se muestran en el chat.
  final bool hidden;
  final Stage stage;
  final bool derivacion;
  final bool cierraEtapa;

  bool get isUser => role == 'user';

  factory UiMessage.fromJson(Map<String, dynamic> j) => UiMessage(
    role: _str(j['role']),
    text: _str(j['text']),
    raw: j['raw'] as String?,
    hidden: j['hidden'] == true,
    stage: Stage.parse(j['stage'] as String?),
    derivacion: j['derivacion'] == true,
    cierraEtapa: j['cierraEtapa'] == true,
  );

  Map<String, dynamic> toJson() => {
    'role': role,
    'text': text,
    if (raw != null) 'raw': raw,
    if (hidden) 'hidden': true,
    'stage': stage.id,
    if (derivacion) 'derivacion': true,
    if (cierraEtapa) 'cierraEtapa': true,
  };
}

enum DocTipo {
  cv('cv', 'CV'),
  linkedin('linkedin', 'LinkedIn');

  const DocTipo(this.id, this.label);
  final String id;
  final String label;

  static DocTipo parse(String? id) => DocTipo.values.firstWhere((t) => t.id == id, orElse: () => DocTipo.cv);
}

class ProfileDoc {
  const ProfileDoc({required this.tipo, required this.nombre, required this.texto});
  final DocTipo tipo;
  final String nombre;
  final String texto;

  factory ProfileDoc.fromJson(Map<String, dynamic> j) =>
      ProfileDoc(tipo: DocTipo.parse(j['tipo'] as String?), nombre: _str(j['nombre']), texto: _str(j['texto']));

  Map<String, dynamic> toJson() => {'tipo': tipo.id, 'nombre': nombre, 'texto': texto};
}

class Observation {
  const Observation({required this.observacion, required this.cita, this.fuente});
  final String observacion;
  final String cita;
  final String? fuente;

  factory Observation.fromJson(Map<String, dynamic> j) =>
      Observation(observacion: _str(j['observacion']), cita: _str(j['cita']), fuente: j['fuente'] as String?);

  Map<String, dynamic> toJson() => {'observacion': observacion, 'cita': cita, if (fuente != null) 'fuente': fuente};
}

class Recommendation {
  const Recommendation({required this.cambio, required this.porQue, required this.cita, required this.tipo, this.fuente});
  final String cambio;
  final String porQue;
  final String cita;
  final String? fuente;

  /// 'mercado' | 'decision_personal'
  final String tipo;

  factory Recommendation.fromJson(Map<String, dynamic> j) => Recommendation(
    cambio: _str(j['cambio']),
    porQue: _str(j['porQue']),
    cita: _str(j['cita']),
    fuente: j['fuente'] as String?,
    tipo: _str(j['tipo']),
  );

  Map<String, dynamic> toJson() => {'cambio': cambio, 'porQue': porQue, 'cita': cita, if (fuente != null) 'fuente': fuente, 'tipo': tipo};
}

List<Observation> _obs(Object? v) => [for (final o in (v as List? ?? const [])) Observation.fromJson(o as Map<String, dynamic>)];

class ProfileReading {
  const ProfileReading({
    required this.primeraImpresion,
    required this.fortalezas,
    required this.ausencias,
    required this.consistenciaMarca,
    required this.recomendaciones,
    required this.nota,
    required this.notaComunica,
  });
  final String primeraImpresion;
  final List<Observation> fortalezas;
  final List<Observation> ausencias;
  final String consistenciaMarca;
  final List<Recommendation> recomendaciones;
  final num nota;
  final String notaComunica;

  factory ProfileReading.fromJson(Map<String, dynamic> j) => ProfileReading(
    primeraImpresion: _str(j['primeraImpresion']),
    fortalezas: _obs(j['fortalezas']),
    ausencias: _obs(j['ausencias']),
    consistenciaMarca: _str(j['consistenciaMarca']),
    recomendaciones: [for (final r in (j['recomendaciones'] as List? ?? const [])) Recommendation.fromJson(r as Map<String, dynamic>)],
    nota: j['nota'] is num ? j['nota'] as num : 0,
    notaComunica: _str(j['notaComunica']),
  );

  Map<String, dynamic> toJson() => {
    'primeraImpresion': primeraImpresion,
    'fortalezas': [for (final o in fortalezas) o.toJson()],
    'ausencias': [for (final o in ausencias) o.toJson()],
    'consistenciaMarca': consistenciaMarca,
    'recomendaciones': [for (final r in recomendaciones) r.toJson()],
    'nota': nota,
    'notaComunica': notaComunica,
  };
}

class ProfileState {
  const ProfileState({required this.puesto, required this.lectura, required this.elegidas});
  final String puesto;
  final ProfileReading lectura;
  final List<int> elegidas;

  ProfileState copyWith({List<int>? elegidas}) => ProfileState(puesto: puesto, lectura: lectura, elegidas: elegidas ?? this.elegidas);

  factory ProfileState.fromJson(Map<String, dynamic> j) => ProfileState(
    puesto: _str(j['puesto']),
    lectura: ProfileReading.fromJson(j['lectura'] as Map<String, dynamic>),
    elegidas: [for (final n in (j['elegidas'] as List? ?? const [])) (n as num).toInt()],
  );

  Map<String, dynamic> toJson() => {'puesto': puesto, 'lectura': lectura.toJson(), 'elegidas': elegidas};
}

class ReportAction {
  const ReportAction({required this.texto, required this.bloque, required this.tipo, required this.fortalezaAncla, required this.cuatroC});
  final String texto;

  /// '70' | '20' | '10'
  final String bloque;

  /// 'pedido' | 'oferta' | 'accion'
  final String tipo;
  final String fortalezaAncla;
  final List<String> cuatroC;

  factory ReportAction.fromJson(Map<String, dynamic> j) => ReportAction(
    texto: _str(j['texto']),
    bloque: _str(j['bloque']),
    tipo: _str(j['tipo']),
    fortalezaAncla: _str(j['fortalezaAncla']),
    cuatroC: _strings(j['cuatroC']),
  );

  Map<String, dynamic> toJson() => {'texto': texto, 'bloque': bloque, 'tipo': tipo, 'fortalezaAncla': fortalezaAncla, 'cuatroC': cuatroC};
}

class Finding {
  const Finding({required this.texto, required this.citaPersona});
  final String texto;
  final String citaPersona;

  factory Finding.fromJson(Map<String, dynamic> j) => Finding(texto: _str(j['texto']), citaPersona: _str(j['citaPersona']));
  Map<String, dynamic> toJson() => {'texto': texto, 'citaPersona': citaPersona};
}

class Report {
  const Report({
    required this.objetivoSesion,
    required this.hallazgos,
    required this.acciones,
    required this.metrica,
    required this.checkIn,
    required this.horizonte,
    required this.preguntaAbierta,
  });
  final String objetivoSesion;
  final List<Finding> hallazgos;
  final List<ReportAction> acciones;
  final String metrica;
  final String checkIn;
  final String horizonte;
  final String preguntaAbierta;

  factory Report.fromJson(Map<String, dynamic> j) => Report(
    objetivoSesion: _str(j['objetivoSesion']),
    hallazgos: [for (final h in (j['hallazgos'] as List? ?? const [])) Finding.fromJson(h as Map<String, dynamic>)],
    acciones: [for (final a in (j['acciones'] as List? ?? const [])) ReportAction.fromJson(a as Map<String, dynamic>)],
    metrica: _str(j['metrica']),
    checkIn: _str(j['checkIn']),
    horizonte: _str(j['horizonte']),
    preguntaAbierta: _str(j['preguntaAbierta']),
  );

  Map<String, dynamic> toJson() => {
    'objetivoSesion': objetivoSesion,
    'hallazgos': [for (final h in hallazgos) h.toJson()],
    'acciones': [for (final a in acciones) a.toJson()],
    'metrica': metrica,
    'checkIn': checkIn,
    'horizonte': horizonte,
    'preguntaAbierta': preguntaAbierta,
  };
}

enum Phase { perfil, chat, informe }

class Session {
  Session({
    required this.path,
    required this.phase,
    required this.stage,
    required this.messages,
    required this.cubiertos,
    required this.sintesis,
    required this.stageReady,
    required this.documentos,
    required this.updatedAt,
    this.foco,
    Map<Stage, List<String>>? omitidos,
    Map<Stage, StageMap>? mapas,
    this.perfil,
    this.informe,
    this.compromisos,
    this.compromisosFecha,
  }) : omitidos = omitidos ?? {},
       mapas = mapas ?? {};

  CoachPath path;
  Phase phase;
  Stage stage;
  List<UiMessage> messages;
  Map<Stage, List<String>> cubiertos;
  Map<Stage, String> sintesis;

  /// Tema sobre el que pregunta el coach ahora (para resaltarlo en el encabezado).
  String? foco;
  Map<Stage, List<String>> omitidos;
  Map<Stage, StageMap> mapas;

  /// La etapa actual está cerrada y espera que la persona avance. Una vez cerrada, no se reabre sola.
  bool stageReady;
  List<ProfileDoc> documentos;
  ProfileState? perfil;
  Report? informe;
  List<int>? compromisos;
  String? compromisosFecha;
  String updatedAt;

  factory Session.nueva(CoachPath path) => Session(
    path: path,
    phase: path == CoachPath.perfil ? Phase.perfil : Phase.chat,
    stage: Stage.diagnostico,
    messages: [],
    cubiertos: {for (final s in Stage.values) s: <String>[]},
    sintesis: {},
    stageReady: false,
    documentos: [],
    updatedAt: DateTime.now().toUtc().toIso8601String(),
  );

  bool get hasProgress => messages.isNotEmpty || perfil != null || informe != null;

  static Map<Stage, T> _byStage<T>(Object? raw, T Function(Object?) conv) => {
    for (final e in ((raw as Map?) ?? const {}).entries) Stage.parse(e.key as String): conv(e.value),
  };

  /// null si la forma no es la esperada (se descarta la sesión en vez de romper la app).
  static Session? fromJson(Map<String, dynamic> j) {
    if (j['version'] != 2) return null;
    final cub = _byStage<List<String>>(j['cubiertos'], _strings);
    return Session(
      path: CoachPath.parse(j['path'] as String?),
      phase: Phase.values.firstWhere((p) => p.name == j['phase'], orElse: () => Phase.chat),
      stage: Stage.parse(j['stage'] as String?),
      messages: [for (final m in (j['messages'] as List? ?? const [])) UiMessage.fromJson(m as Map<String, dynamic>)],
      cubiertos: {for (final s in Stage.values) s: cub[s] ?? <String>[]},
      sintesis: _byStage<String>(j['sintesis'], (v) => _str(v)),
      stageReady: j['stageReady'] == true,
      documentos: [for (final d in (j['documentos'] as List? ?? const [])) ProfileDoc.fromJson(d as Map<String, dynamic>)],
      updatedAt: _str(j['updatedAt']),
      foco: j['foco'] as String?,
      omitidos: _byStage<List<String>>(j['omitidos'], _strings),
      mapas: _byStage<StageMap>(j['mapas'], (v) => StageMap.fromJson(v as Map<String, dynamic>)),
      perfil: j['perfil'] == null ? null : ProfileState.fromJson(j['perfil'] as Map<String, dynamic>),
      informe: j['informe'] == null ? null : Report.fromJson(j['informe'] as Map<String, dynamic>),
      compromisos: j['compromisos'] == null ? null : [for (final n in j['compromisos'] as List) (n as num).toInt()],
      compromisosFecha: j['compromisosFecha'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
    'version': 2,
    'path': path.id,
    'phase': phase.name,
    'stage': stage.id,
    'messages': [for (final m in messages) m.toJson()],
    'cubiertos': {for (final e in cubiertos.entries) e.key.id: e.value},
    'sintesis': {for (final e in sintesis.entries) e.key.id: e.value},
    if (foco != null) 'foco': foco,
    'omitidos': {for (final e in omitidos.entries) e.key.id: e.value},
    'mapas': {for (final e in mapas.entries) e.key.id: e.value.toJson()},
    'stageReady': stageReady,
    'documentos': [for (final d in documentos) d.toJson()],
    if (perfil != null) 'perfil': perfil!.toJson(),
    if (informe != null) 'informe': informe!.toJson(),
    if (compromisos != null) 'compromisos': compromisos,
    if (compromisosFecha != null) 'compromisosFecha': compromisosFecha,
    'updatedAt': updatedAt,
  };
}
