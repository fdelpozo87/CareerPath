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
  perfil('perfil'),

  /// Camino C: decidir en qué formarse (solo mayores de 18).
  formacion('formacion');

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

// Camino C — decidir en qué formarse. Misma estructura de tres etapas; cambian los temas.
// El servicio no conoce la oferta educativa vigente: indaga lo que la persona sabe, quiere y puede.
const formacionObjectives = <Stage, List<StageObjective>>{
  Stage.diagnostico: [
    StageObjective('proposito', 'Lo que querés lograr', omitible: false),
    StageObjective('situacion', 'Tu situación hoy', omitible: false),
    StageObjective('alternativas', 'Lo que ya evaluás', omitible: true),
    StageObjective('compromiso', 'Lo que podés invertir', omitible: true),
  ],
  Stage.discovery: [
    StageObjective('intereses', 'Lo que te interesa', omitible: false),
    StageObjective('aptitudes', 'Lo que se te da bien', omitible: true),
    StageObjective('criterios', 'Tus criterios', omitible: false),
  ],
  Stage.plan: [
    StageObjective('eleccion', 'Tu elección', omitible: false),
    StageObjective('horizonte', 'Tu plazo', omitible: false),
    StageObjective('presupuesto', 'Tu presupuesto', omitible: false),
    StageObjective('primer_paso', 'Tu primer paso', omitible: false),
    StageObjective('respaldo', 'Tu plan B', omitible: true),
  ],
};

const formacionIntro = <Stage, StageIntro>{
  Stage.diagnostico: StageIntro(
    titulo: 'Tu mapa del Diagnóstico',
    queHacemos: 'Entender qué querés lograr y con qué condiciones contás',
    despues: 'Discovery: tus intereses y tus criterios',
  ),
  Stage.discovery: StageIntro(
    titulo: 'Tu mapa de Discovery',
    queHacemos: 'Aclarar qué te interesa y con qué criterios vas a comparar',
    despues: 'Plan de Acción: elegir y dar el primer paso',
  ),
  Stage.plan: StageIntro(
    titulo: 'Tu plan de formación, en tus palabras',
    queHacemos: 'Elegir por dónde empezar y darle forma',
    despues: 'Tu informe final',
  ),
};

/// Los temas de indagación de una etapa según el camino elegido.
List<StageObjective> objectivesFor(Stage stage, CoachPath path) =>
    path == CoachPath.formacion ? formacionObjectives[stage]! : stageObjectives[stage]!;

/// Orientación de cada etapa según el camino.
StageIntro introFor(Stage stage, CoachPath path) =>
    path == CoachPath.formacion ? formacionIntro[stage]! : stageIntro[stage]!;

/// Cuántos temas puede dejar para después la persona en una misma etapa (decisión de producto).
const maxOmitidosPorEtapa = 1;
