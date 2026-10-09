// Etapas y objetivos de indagación (espejo de shared/stages.ts). La lógica de qué cubre cada
// etapa vive en el servidor; acá solo lo necesario para mostrar el progreso.

enum Stage {
  diagnostico('diagnostico', 'Diagnóstico'),
  discovery('discovery', 'Discovery'),
  plan('plan', 'Plan de Acción');

  const Stage(this.id, this.label);
  final String id;
  final String label;

  static Stage parse(String? id) => Stage.values.firstWhere((s) => s.id == id, orElse: () => Stage.diagnostico);

  Stage? get next => index + 1 < Stage.values.length ? Stage.values[index + 1] : null;
}

enum CoachPath {
  quiebre('quiebre'),
  perfil('perfil');

  const CoachPath(this.id);
  final String id;

  static CoachPath parse(String? id) => CoachPath.values.firstWhere((p) => p.id == id, orElse: () => CoachPath.quiebre);
}

class StageObjective {
  const StageObjective(this.id, this.label, {required this.omitible});
  final String id;
  final String label;

  /// La persona puede dejarlo "para más adelante" y la etapa cierra igual.
  final bool omitible;
}

const stageObjectives = <Stage, List<StageObjective>>{
  Stage.diagnostico: [
    StageObjective('goal', 'Lo que buscás', omitible: false),
    StageObjective('reality', 'Dónde estás hoy', omitible: false),
    StageObjective('options', 'Tus caminos', omitible: true),
    StageObjective('will', 'Tu compromiso', omitible: true),
  ],
  Stage.discovery: [
    StageObjective('reencuadre', 'Tu obstáculo', omitible: true),
    StageObjective('escenarios', 'Tus escenarios', omitible: false),
    StageObjective('cuatro_c', 'Qué te da fuerza', omitible: true),
  ],
  Stage.plan: [
    StageObjective('objetivo_desarrollo', 'Tu objetivo', omitible: false),
    StageObjective('horizonte', 'Tu plazo', omitible: false),
    StageObjective('accion_fortaleza', 'Desde tu fortaleza', omitible: true),
    StageObjective('pedido', 'A quién le pedís', omitible: false),
    StageObjective('metrica', 'Cómo lo seguís', omitible: true),
  ],
};

class StageIntro {
  const StageIntro({required this.titulo, required this.queHacemos, required this.despues});
  final String titulo;
  final String queHacemos;
  final String despues;
}

const stageIntro = <Stage, StageIntro>{
  Stage.diagnostico: StageIntro(
    titulo: 'Tu mapa del Diagnóstico',
    queHacemos: 'Entender dónde estás y qué querés',
    despues: 'Discovery: explorar caminos',
  ),
  Stage.discovery: StageIntro(
    titulo: 'Tu mapa de Discovery',
    queHacemos: 'Explorar caminos posibles',
    despues: 'Plan de Acción: pasos concretos',
  ),
  Stage.plan: StageIntro(
    titulo: 'Tu plan, en tus palabras',
    queHacemos: 'Convertirlo en pasos concretos',
    despues: 'Tu informe final',
  ),
};

/// Cuántos temas puede dejar para después la persona en una misma etapa (decisión de producto).
const maxOmitidosPorEtapa = 1;
