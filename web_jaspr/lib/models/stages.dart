import '../i18n/i18n.dart';

// Etapas y objetivos de indagación (espejo de shared/stages.ts). La lógica de qué cubre cada
// etapa vive en el servidor; acá solo lo necesario para mostrar el progreso.

enum Stage {
  diagnostico('diagnostico'),
  discovery('discovery'),
  plan('plan');

  const Stage(this.id);
  final String id;
  /// Nombre de la etapa en el idioma actual.
  String get label => tl('stage.$id');

  static Stage parse(String? id) => Stage.values.firstWhere((s) => s.id == id, orElse: () => Stage.diagnostico);

  Stage? get next => index + 1 < Stage.values.length ? Stage.values[index + 1] : null;
}

enum CoachPath {
  quiebre('quiebre'),
  perfil('perfil'),

  /// Camino C: decidir en qué formarse (solo mayores de 18).
  formacion('formacion');

  const CoachPath(this.id);
  final String id;

  static CoachPath parse(String? id) => CoachPath.values.firstWhere((p) => p.id == id, orElse: () => CoachPath.quiebre);
}

class StageObjective {
  const StageObjective(this.id, {required this.omitible});
  final String id;

  /// Nombre del tema en el idioma actual.
  String get label => tl('obj.$id');

  /// La persona puede dejarlo "para más adelante" y la etapa cierra igual.
  final bool omitible;
}

const stageObjectives = <Stage, List<StageObjective>>{
  Stage.diagnostico: [
    StageObjective('goal', omitible: false),
    StageObjective('reality', omitible: false),
    StageObjective('options', omitible: true),
    StageObjective('will', omitible: true),
  ],
  Stage.discovery: [
    StageObjective('reencuadre', omitible: true),
    StageObjective('escenarios', omitible: false),
    StageObjective('cuatro_c', omitible: true),
  ],
  Stage.plan: [
    StageObjective('objetivo_desarrollo', omitible: false),
    StageObjective('horizonte', omitible: false),
    StageObjective('accion_fortaleza', omitible: true),
    StageObjective('pedido', omitible: false),
    StageObjective('metrica', omitible: true),
  ],
};

class StageIntro {
  const StageIntro({required this.titulo, required this.queHacemos, required this.despues});
  final String titulo;
  final String queHacemos;
  final String despues;
}

/// Orientación de cada etapa según el camino (en el idioma actual): qué se hace ahora y qué viene después.
StageIntro introFor(Stage stage, CoachPath path) {
  final group = path == CoachPath.formacion ? 'formacion' : 'default';
  String at(String field) => tl('intro.$group.${stage.id}.$field');
  return StageIntro(titulo: at('titulo'), queHacemos: at('queHacemos'), despues: at('despues'));
}

// Camino C — decidir en qué formarse. Misma estructura de tres etapas; cambian los temas.
// El servicio no conoce la oferta educativa vigente: indaga lo que la persona sabe, quiere y puede.
const formacionObjectives = <Stage, List<StageObjective>>{
  Stage.diagnostico: [
    StageObjective('proposito', omitible: false),
    StageObjective('situacion', omitible: false),
    StageObjective('alternativas', omitible: true),
    StageObjective('compromiso', omitible: true),
  ],
  Stage.discovery: [
    StageObjective('intereses', omitible: false),
    StageObjective('aptitudes', omitible: true),
    StageObjective('criterios', omitible: false),
  ],
  Stage.plan: [
    StageObjective('eleccion', omitible: false),
    StageObjective('horizonte', omitible: false),
    StageObjective('presupuesto', omitible: false),
    StageObjective('primer_paso', omitible: false),
    StageObjective('respaldo', omitible: true),
  ],
};

/// Los temas de indagación de una etapa según el camino elegido.
List<StageObjective> objectivesFor(Stage stage, CoachPath path) =>
    path == CoachPath.formacion ? formacionObjectives[stage]! : stageObjectives[stage]!;

/// Cuántos temas puede dejar para después la persona en una misma etapa (decisión de producto).
const maxOmitidosPorEtapa = 1;
