import type { TemplateRole } from "@/services/template.service";

export type DefaultRequirementTemplate = {
  role: TemplateRole;
  norma: string;
  item: string;
  titulo: string;
  descripcion: string;
};

export const DEFAULT_REQUIREMENT_TEMPLATES = [
  {
    "role": "adjudicador",
    "norma": "19650-1",
    "item": "5.1",
    "titulo": "PRINCIPIOS",
    "descripcion": "¿Indica el adjudicador sus objetivos para requerir entregables de información al resto de partes interesadas? \nEj.: Apoyo al cumplimiento reglamentario, gestión de riesgos, impactos previstos medioambientales, ¿etc.?"
  },
  {
    "role": "adjudicador",
    "norma": "19650-1",
    "item": "5.2",
    "titulo": "REQUISITOS DE INFORMACIÓN DE LA ORGANIZACIÓN (OIR)",
    "descripcion": "¿Tiene el adjudicador definidos sus objetivos organizacionales para poder formular unos requerimientos de información coherentes a sus necesidades?"
  },
  {
    "role": "adjudicador",
    "norma": "19650-1",
    "item": "5.3",
    "titulo": "REQUISITOS DE INFORMACIÓN DEL ACTIVO (AIR)",
    "descripcion": "¿Se han elaborado unos AIR coherentes y coordinados para dar respuesta a los OIR relacionados con los activos?"
  },
  {
    "role": "adjudicador",
    "norma": "19650-1",
    "item": "5.4",
    "titulo": "REQUISITOS DE INFORMACIÓN DEL PROYECTO (PIR)",
    "descripcion": "¿Existen los mecanismos para desarrollar un conjunto de requisitos de información que satisfagan los OIR para cada uno de los puntos clave de decisión del adjudicador durante el desarrollo de proyectos?"
  },
  {
    "role": "adjudicador",
    "norma": "19650-1",
    "item": "5.5",
    "titulo": "REQUISITOS DE INTERCAMBIO DE INFORMACIÓN",
    "descripcion": "¿Se han incorporado en los EIR los estándares de información y los métodos y procedimientos de producción que implementará el equipo de desarrollo? ¿Recogen aspectos de gestión, comerciales y técnicos de la producción de la información del proyecto?\n¿Se encuentran alineados con los eventos desencadenantes que representan la finalización de todos o parte de los hitos del proyecto?"
  },
  {
    "role": "adjudicador",
    "norma": "19650-1",
    "item": "6.2",
    "titulo": "ALINEAMIENTO CON EL CICLO DE VIDA DEL ACTIVO",
    "descripcion": "¿Es consciente el adjudicador de su responsabilidad en el liderazgo y la gobernanza en relación con la gestión de la información de los activos y la vinculación de la gestión de estos activos con el logro de sus objetivos empresariales a través de políticas, estrategias y planes de gestión?"
  },
  {
    "role": "adjudicador",
    "norma": "19650-1",
    "item": "6.3.1",
    "titulo": "PRINCIPIOS GENERALES",
    "descripcion": "¿Tiene definido el adjudicador, por medio de conjuntos de requisitos, toda información que deberá aportar a lo largo del ciclo de vida del activo y del proyecto? ¿Transmite estos requisitos a los adjudicatarios principales ofertantes antes de la contratación?"
  },
  {
    "role": "adjudicador",
    "norma": "19650-1",
    "item": "6.3.2",
    "titulo": "EL EQUIPO DE DESARROLLO PROPORCIONA INFORMACIÓN PARA LAS DECISIONES DEL PROPIETARIO/OPERADOR DE ACTIVOS O DEL CLIENTE",
    "descripcion": "¿Tiene definido el adjudicador los momentos en los que tiene que tomar decisiones clave estableciendo con precisión qué información requiere del equipo de desarrollo?\n¿Están acordados y documentados los procedimientos de aprobación y aceptación antes de que se realice cualquier intercambio de información?"
  },
  {
    "role": "adjudicador",
    "norma": "19650-1",
    "item": "6.3.3",
    "titulo": "VERIFICACIÓN Y VALIDACIÓN DE LA INFORMACIÓN AL INICIO Y AL FINAL DE LAS ETAPAS DEL PROYECTO",
    "descripcion": "¿Se realiza una segunda verificación cuando comienza una etapa del proyecto o cuando se produce un cambio del adjudicatorio entre una etapa y la siguiente?\n¿Se verifica la información si hay un cambio de adjudicatario principal durante una etapa del proyecto?"
  },
  {
    "role": "adjudicador",
    "norma": "19650-1",
    "item": "6.3.4",
    "titulo": "LA INFORMACIÓN SE OBTIENE DE TODO EL EQUIPO DE DESARROLLO",
    "descripcion": "¿Está definido en los programas de desarrollo el rol de cada adjudicatario principal para satisfacer el AIR?"
  },
  {
    "role": "adjudicador",
    "norma": "19650-1",
    "item": "7.1",
    "titulo": "PRINCIPIOS",
    "descripcion": "¿Se integra en las contrataciones las funciones, responsabilidades, autoridad y alcance de cualquier tarea en el documento de contratación?"
  },
  {
    "role": "adjudicador",
    "norma": "19650-1",
    "item": "7.2",
    "titulo": "FUNCIONES DE LA GESTIÓN DE INFORMACIÓN DE ACTIVOS",
    "descripcion": "¿El adjudicador tiene asignadas una o más personas que lideren el proceso de validación de la información suministrada por los adjudicatarios en referencia a la gestión de la información de activos y su posterior autorización para su inclusión en el AIM?\n¿El adjudicador se asegura que al final del proyecto la información clave incluye información sobre operación y mantenimiento de los activos?"
  },
  {
    "role": "adjudicador",
    "norma": "19650-1",
    "item": "7.3",
    "titulo": "FUNCIONES DE LA GESTIÓN DE LA INFORMACIÓN DE PROYECTOS",
    "descripcion": "¿Asigna el adjudicador la responsabilidad del desarrollo de la información a los adjudicatarios principales de forma específica y documentada en los documentos de contratación?"
  },
  {
    "role": "adjudicador",
    "norma": "19650-1",
    "item": "8.1",
    "titulo": "PRINCIPIOS",
    "descripcion": "¿Tiene el adjudicador, o de forma delegada, establecidos mecanismos de evaluación de la aptitud y capacidad del equipo de desarrollo ofertante?"
  },
  {
    "role": "adjudicador",
    "norma": "19650-1",
    "item": "8.2",
    "titulo": "ALCANCE DE LA EVALUACIÓN DE APTITUDES Y CAPACIDADES",
    "descripcion": "¿En la evaluación se tienen en cuenta los aspectos de compromiso, capacidad, acceso y experiencia en las TI previstas o el número de personas con experiencia que estén adecuadamente equipadas dentro del equipo de desarrollo propuesto y su disponibilidad para trabajar en las tareas del activo o proyecto propuesto?"
  },
  {
    "role": "adjudicador",
    "norma": "19650-1",
    "item": "10.2",
    "titulo": "CALENDARIO DE DESARROLLO DE LA INFORMACIÓN",
    "descripcion": "¿Se ha definido un programa de desarrollo de la información para todo el proyecto, o para la gestión de activos a corto o medio plazo de acuerdo con el cronograma y la contratación de las partes?"
  },
  {
    "role": "adjudicador",
    "norma": "19650-1",
    "item": "10.3",
    "titulo": "MATRIZ DE RESPONSABILIDADES",
    "descripcion": "¿Se genera una matriz de responsabilidades como parte del proceso de planificación de desarrollo de la información con uno o más niveles de detalle?"
  },
  {
    "role": "adjudicador",
    "norma": "19650-1",
    "item": "10.4",
    "titulo": "DEFINICIÓN DE LA ESTRATEGIA DE FEDERACIÓN Y ESTRUCTURA DE DISTRIBUCIÓN DE LOS CONTENEDORES DE INFORMACIÓN",
    "descripcion": "¿Se define y acuerda colaborativamente la estrategia de federación y la descomposición estructural del proyecto? \n¿La estrategia de federación refleja cómo se relacionan las estructuras de contenedores de información descompuestas?\n¿Se han establecido referencias cruzadas entre los contenedores de información y los equipos de trabajo dentro de la estructura de distribución de los contenedores de información?\n¿Se ha comunicado a todas las organizaciones involucradas en las actividades del proyecto la estrategia de federación y la estructura de distribución de los contenedores de información?\n¿Se tiene en cuenta en su realización el enfoque estratégico del desarrollo del proyecto y la gestión de activos?\n¿Se tiene en cuenta los niveles de información como la cantidad mínima de información necesaria para satisfacer cada requisito relevante?"
  },
  {
    "role": "adjudicador",
    "norma": "19650-1",
    "item": "11.2",
    "titulo": "NIVEL DE INFORMACIÓN NECESARIA",
    "descripcion": "¿Esta descrito claramente en el OIR, PIR, AIR o EIR los rangos de métricas (pe. BIMFORUM, Standard BIM para proyectos públicos, ISO 17412,…) para determinar los niveles de información necesaria para los proyectos o activos?\n¿Se tiene en cuenta los niveles de información como la cantidad mínima de información necesaria para satisfacer cada requisito relevante?[J"
  },
  {
    "role": "adjudicador",
    "norma": "19650-1",
    "item": "11.3",
    "titulo": "CALIDAD DE LA INFORMACIÓN",
    "descripcion": "¿Se ha acordado la información del CDE en términos de formato de información, formato de entrega, estructura del modelo de información, los medios para estructurar y clasificar la información y los nombres de los atributos para metadatos?\n¿Se tiene en cuenta que la clasificación de los objetos debería estar de acuerdo con los principios de la norma ISO 12006-2 y la información del objeto a la ISO 12006-3 (pe UNICLASS, OMNICLASS, …?[J"
  },
  {
    "role": "adjudicador",
    "norma": "19650-1",
    "item": "12.1",
    "titulo": "PRINCIPIOS",
    "descripcion": "¿Se almacenan los CI dentro de CDE en alguno de estos tres estados: trabajo en curso (WIP); compartido (SHA) o publicado (PUB)?\n¿Se tiene en cuenta que cada CI administrado en el CDE debería tener los metadatos de código de revisión, de acuerdo con una norma acordada, por ejemplo, la IEC 82045-1, y un código de estado para indicar el uso o usos permitidos de la información?\n¿Se ha incluido en sus requisitos AIR y PIR que los adjudicatarios principales deben tener en cuenta durante el desarrollo de sus respectivos PIM (el modelo de diseño del proyectista-diseñador y el modelo de construcción del contratista-constructor) los requisitos de la futura transferencia de información desde el PIM final al AIM?\n¿Se guardan el resto de los contenedores, incluidos los \"archivados\" para facilitar su consulta posterior?"
  },
  {
    "role": "adjudicador",
    "norma": "19650-2",
    "item": "5.1.1",
    "titulo": "Designar a los responsables de la función de gestión de la información.",
    "descripcion": "¿Se han designado por parte del Adjudicador las personas de su organización responsables de la gestión de la información, o ha delegado en un Adjudicatario Principal o un tercero dicha función estableciendo claramente el alcance de los servicios?"
  },
  {
    "role": "adjudicador",
    "norma": "19650-2",
    "item": "5.1.2",
    "titulo": "Establecer los requisitos de información del proyecto.",
    "descripcion": "¿Ha establecido el Adjudicador los requisitos de información del proyecto tal y como establece la norma UNE EN ISO 19650-1:2018 Apto. 5.3 con relación al: alcance del proyecto, el propósito para el cual la información será utilizada por el adjudicador; el plan de trabajo del proyecto; la vía de adquisición prevista; el número de puntos clave de decisión a lo largo del proyecto; las decisiones que el adjudicador tiene que tomar en cada punto clave de decisión; y  las preguntas que el adjudicador necesita responder para tomar decisiones en base a información?"
  },
  {
    "role": "adjudicador",
    "norma": "19650-2",
    "item": "5.1.3",
    "titulo": "Establecer los hitos de entrega de la información del proyecto.",
    "descripcion": "¿Ha establecido el Adjudicador los hitos de entrega de información del proyecto de acuerdo con el plan de trabajo del proyecto, concretando los puntos clave de decisión del adjudicador; sus propias obligaciones de entrega de información (si las hubiera); la naturaleza y el contenido de la información que hay que facilitar en cada punto clave de decisión; y la(s) fecha(s) relativa(s) a cada punto clave de decisión en el que hay que entregar el modelo de información?"
  },
  {
    "role": "adjudicador",
    "norma": "19650-2",
    "item": "5.1.4",
    "titulo": "Establecer la norma de información del proyecto",
    "descripcion": "¿Ha establecido el Adjudicador las normas especificas de información requeridas teniendo en cuenta el intercambio de información dentro de la organización del propio Adjudicador, entre el adjudicador y las partes interesadas externas, entre el adjudicador y los operadores externos o proveedores de mantenimiento, entre el adjudicatario principal y el adjudicador, entre los adjudicatarios en el mismo proyecto, y entre proyectos interdependientes; cuáles son los medios disponibles para estructurar y clasificar la información; el método de asignación para el nivel de información necesario; y cuál va a ser el uso de la información durante la fase de operación del activo?"
  },
  {
    "role": "adjudicador",
    "norma": "19650-2",
    "item": "5.1.5",
    "titulo": "Establecer los métodos y procedimientos para la producción de información del proyecto.",
    "descripcion": "¿Ha establecido los métodos y procedimientos de producción de la información requeridos por su organización como parte de los métodos y procedimientos de producción de la información del proyecto teniendo en cuenta la captura de la información existente sobre los activos; la producción, revisión o aprobación de nueva información; la seguridad o distribución de la información; y la entrega de información al adjudicador."
  },
  {
    "role": "adjudicador",
    "norma": "19650-2",
    "item": "5.1.6",
    "titulo": "Establecer la información de referencia del proyecto y los recursos compartidos.",
    "descripcion": "¿Ha establecido el Adjudicador la información de referencia del proyecto y los recursos que va a compartir con los Adjudicatarios Principales durante la licitación o la adjudicación utilizando, cuando sea posible, normas de datos abiertos teniendo en cuenta: \n- información sobre los activos existentes:\n- de la organización del adjudicador,\n- de los propietarios de los activos adyacentes (empresas de servicios públicos, etc.),\n- bajo licencia de proveedores externos (mapeo e imágenes, etc.), y\n- contenidas en bibliotecas públicas y otras fuentes de registros históricos;\nb) recursos compartidos, por ejemplo:\n- plantillas de salida de procesos (plan de ejecución del BIM, programa general de desarrollo de la información, MIDP, etc.),\n- plantillas de contenedores de información (modelos geométricos 2D/3D, documentos, etc.),\n- bibliotecas de estilo (líneas, texto y sombreado, etc.), o\n- bibliotecas de objetos (símbolos 2D, objetos 3D, etc.);\n- objetos de biblioteca definidos en el marco de normas nacionales y regionales."
  },
  {
    "role": "adjudicador",
    "norma": "19650-2",
    "item": "5.1.7",
    "titulo": "Establecer el entorno común de datos (CDE) del proyecto.",
    "descripcion": "¿Establece, implementa, configura y apoya un CDE del proyecto bien de forma directa o a través de un tercero?\n¿Asigna a cada CI (Contenedor de información) un identificador único basado en un convenio acordado y documentado compuesto por campos separados por un delimitador?\n¿Asigna a cada campo un valor determinado con arreglo a una norma de codificación acordada y documentada?\n¿Asigna a cada CI los atributos de idoneidad, revisión y clasificación de acuerdo con la norma ISO 12006-2?\n¿Pueden los CI cambiar de estado?\n¿Se registro del nombre del usuario y la fecha cuando se cambia el estado de una revisión del CI?"
  },
  {
    "role": "adjudicador",
    "norma": "19650-2",
    "item": "5.1.8",
    "titulo": "Establecer el protocolo de intercambio de información del proyecto.",
    "descripcion": "¿Ha establecido el Adjudicador el protocolo de intercambio de información del proyecto teniendo en cuenta:\n- las obligaciones específicas del adjudicador, los adjudicatarios principales y los adjudicatarios propuestos en relación con la gestión o producción de información, incluida la utilización del entorno común de datos del proyecto;\n- las garantía o responsabilidades asociadas al modelo de información del proyecto;\n- antecedentes y derechos de propiedad intelectual de la información;\n- el uso de la información de los activos existentes;\n- el uso de recursos compartidos;el uso de la información durante el proyecto, incluidas las condiciones de concesión de licencias asociadas; y\n- la reutilización de la información después de la adjudicación o en caso de rescisión."
  },
  {
    "role": "adjudicador",
    "norma": "19650-2",
    "item": "5.2.1",
    "titulo": "Petición de ofertas. Establecer los requisitos de intercambio de inforrmación del Adjudicador.",
    "descripcion": "¿Se establecen los requisitos que el Adjudicador tiene que cumplir durante la contratación, el nivel de información de cada requisito de información, los criterios de aceptación, la información de apoyo que los adjudicatarios principales pueda necesitar y las fechas basadas en los hitos de entrega de dicha información?"
  },
  {
    "role": "adjudicador",
    "norma": "19650-2",
    "item": "5.2.2",
    "titulo": "Reunir la información de referencia y los recursos compartidos.",
    "descripcion": "¿Reune la información de referencia o los recursos compartidos que tiene la intención de proporcionar al adjudicatario principal durante el proceso de petición de ofertas o adjudicación?"
  },
  {
    "role": "adjudicador",
    "norma": "19650-2",
    "item": "5.2.3",
    "titulo": "Establecer los requisitos de presentación de ofertas y los criterios de evaluación.",
    "descripcion": "¿Ha establcido el Adjudicador los requisitos de las organizaciones licitadoras en su licitación teniendo en cuenta:\n– el contenido del plan de ejecución del BIM del equipo de desarrollo (antes de la adjudicación);\n– las competencias requeridas de las personas consideradas para desempeñar la función de gestión de la información en nombre del equipo de desarrollo;\n– la evaluación por el adjudicatario principal propuesta de las habilidades y capacidad del equipo de desarrollo;\n– el plan de movilización propuesto por el equipo de desarrollo; y\n– la evaluación de riesgos asociados a la entrega de información por parte del equipo de desarrollo."
  },
  {
    "role": "adjudicador",
    "norma": "19650-2",
    "item": "5.2.4",
    "titulo": "Recopilar la información relativa a la licitación.",
    "descripcion": "¿Ha recoplidado el Adjudicador la información a incluir en los documentos de la licitación teniendo en cuenta:\n– los requisitos del intercambio de información del adjudicador;\n– la información de referencia pertinente y los recursos compartidos (en el entorno común de datos del proyecto);\n– los requisitos de presentación y los criterios de evaluación (si procede);\n– los hitos de entrega de información del proyecto;\n– la norma de información del proyecto;\n– los métodos y procedimientos de producción de información del proyecto; y\n– el protocolo de intercambio de información del proyecto."
  },
  {
    "role": "adjudicador",
    "norma": "19650-2",
    "item": "5.3.1",
    "titulo": "Presentación de ofertas. Designación de los responsables de la gestión de la información.",
    "descripcion": "Tiene en cuenta el adjudicador, a la vista de lo anterior, aspectos como: \nsu EIR,\nlas tareas de las que será responsable el adjudicatario o tercero;\nla autoridad que el adjudicatario principal propuesta delegará en el adjudicatorio propuesto o tercero,\nlas competencias requeridas a las personas que desempeñen esta función o los posibles acuerdos de probidad en caso de conflicto de intereses"
  },
  {
    "role": "adjudicador",
    "norma": "19650-2",
    "item": "5.4.6",
    "titulo": "Completar los documentos de adjudicación del adjudicatario principal",
    "descripcion": "¿Se ha asegurado el Adjudicador que los siguientes elementos se incluyan en los documentos de adjudicación cumplimentados del adjudicatario principal y que se gestionen mediante un control de cambios durante toda la adjudicación:\n– los requisitos del intercambio de información del adjudicador;\n– la norma de información del proyecto (incluidas las adiciones o modificaciones acordadas);\n– el protocolo de información del proyecto (incluyendo cualquier adición o modificación acordada);\n– el plan de ejecución del BIM del equipo de desarrollo; y\n– el MIDP del equipo de desarrollo."
  },
  {
    "role": "adjudicador",
    "norma": "19650-2",
    "item": "5.7.4",
    "titulo": "Revisar y aceptar el modelo de información",
    "descripcion": "¿El Adjudicador ha revisado y aprobado el modelo de información teniendo especilamente en cuenta: \n- los entregables incluidos en el programa general de desarrollo de la información;\n- los requisitos del intercambio de información del adjudicador;\n- los criterios de aceptación de cada requisito de información; y\n- el nivel de información necesario para cada requisito de información?"
  },
  {
    "role": "adjudicador",
    "norma": "19650-2",
    "item": "5.8.1",
    "titulo": "Archivar el modelo de información del proyecto",
    "descripcion": "¿Se realiza el archivo de los CI en el CDE de acuerdo con los métodos y procedimientos de producción de la información del proyecto?\n¿Se tienen en cuenta los CI necesarios para el AIM, los requisitos de acceso y reutilización futura de esta información, así como las políticas de conservaciones a aplicar?"
  },
  {
    "role": "adjudicador",
    "norma": "19650-2",
    "item": "5.8.2",
    "titulo": "Recoger las lecciones aprendidas para futuros proyectos",
    "descripcion": "¿Se recopila y registra en una BD de conocimiento adecuada las lecciones aprendidas a lo largo del proyecto?"
  },
  {
    "role": "adjudicatario_principal",
    "norma": "19650-1",
    "item": "6.3.2",
    "titulo": "El equipo de desarrollo proporciona información para las decisiones del propietario/operador de activos o del cliente",
    "descripcion": "¿Están acordados y documentados los procedimientos de aprobación y aceptación antes de que se realice cualquier intercambio de información?"
  },
  {
    "role": "adjudicatario_principal",
    "norma": "19650-1",
    "item": "6.3.3",
    "titulo": "Verificación y validación de la información al inicio y al final de las etapas del proyecto",
    "descripcion": "¿Se verifica y validad la información del proyecto al inicio y final de cada etapa? ¿Se realiza una segunda verificación cuando comienza una etapa del proyecto o cuando se produce un cambio del adjudicatario entre una etapa y la siguiente?"
  },
  {
    "role": "adjudicatario_principal",
    "norma": "19650-1",
    "item": "6.3.4",
    "titulo": "La información se obtiene de todo el equipo de desarrollo",
    "descripcion": "¿Está definido en los programas de desarrollo el rol de cada adjudicatario principal para satisfacer el AIR o EIR según corresponda?"
  },
  {
    "role": "adjudicatario_principal",
    "norma": "19650-1",
    "item": "7.2",
    "titulo": "Función de gestión de la información de activos",
    "descripcion": "¿Se entrega dentro de la información clave de cualquier proyecto la referida a las operaciones y mantenimiento del activo?"
  },
  {
    "role": "adjudicatario_principal",
    "norma": "19650-1",
    "item": "10.1",
    "titulo": "Planificación del desarrollo de la información. Principios.",
    "descripcion": "¿Desarrolla el adjudicatario principal y los adjudicatarios la planificación del desarrollo de la información en respuesta a los requisitos de información del adjudicador, en términos de cómo cumplir con los requisitos definidos en el AIR o EIR; cuando se entregará la información en relación con los hitos del proyecto; como se coordinará la información con la de otro adjudicatario relevante; que información se va a desarrollar; quién será el responsable de desarrollarla y quién será el destinatario de ella?\n¿La planificación refleja el alcance de la contratación a lo largo del ciclo de vida del activo?\n¿Se desarrolla parte de esta planificación antes de la contratación para ser revisada por el adjudicador?\n¿Se tiene en cuenta que cada contenedor de información esté vinculado con uno o más requisitos de información predefinidos?"
  },
  {
    "role": "adjudicatario_principal",
    "norma": "19650-1",
    "item": "10.2",
    "titulo": "Calendario de Desarrollo de la información.",
    "descripcion": "¿Se ha definido un programa de desarrollo de la información para todo el proyecto, o para la gestión de activos a corto o medio plazo de acuerdo con el cronograma y la contratación de las partes?\n¿Se ha definido un calendario de entrega de información dentro de cada programa?"
  },
  {
    "role": "adjudicatario_principal",
    "norma": "19650-1",
    "item": "10.3",
    "titulo": "Matriz de responsabilidad",
    "descripcion": "¿Se genera una matriz de responsabilidades como parte del proceso de planificación de desarrollo de la información con uno o más niveles de detalle?"
  },
  {
    "role": "adjudicatario_principal",
    "norma": "19650-1",
    "item": "10.4",
    "titulo": "Definición de la estrategia de federación y estructura de distribución de los contenedores de información",
    "descripcion": "¿Se define y acuerda colaborativamente la estrategia de federación y la descomposición estructural del proyecto? \n¿La estrategia de federación refleja cómo se relacionan las estructuras de contenedores de información descompuestas?\n¿Se han establecido referencias cruzadas entre los contenedores de información y los equipos de trabajo dentro de la estructura de distribución de los contenedores de información?\n¿Se ha comunicado a todas las organizaciones involucradas en las actividades del proyecto la estrategia de federación y la estructura de distribución de los contenedores de información?\n¿Se tiene en cuenta en su realización el enfoque estratégico del desarrollo del proyecto y la gestión de activos?"
  },
  {
    "role": "adjudicatario_principal",
    "norma": "19650-1",
    "item": "11.2",
    "titulo": "Nivel de información necesario",
    "descripcion": "¿Se ha determinado el nivel de información necesario de cada entregable? ¿Se tiene en cuenta los niveles de información como la cantidad mínima de información necesaria para satisfacer cada requisito relevante?"
  },
  {
    "role": "adjudicatario_principal",
    "norma": "19650-1",
    "item": "11.3",
    "titulo": "Calidad de la información",
    "descripcion": "¿Se ha acordado la información del CDE en términos de formato de información, formato de entrega, estructura del modelo de información, los medios para estructurar y clasificar la información y los nombres de los atributos para metadatos?\n¿Se tiene en cuenta que la clasificación de los objetos debería estar de acuerdo con los principios de la norma ISO 12006-2 y la información del objeto a la ISO 12006-3?"
  },
  {
    "role": "adjudicatario_principal",
    "norma": "19650-1",
    "item": "12.1",
    "titulo": "Solución de entorno común de datos (CDE) y flujo de trabajo. Principios.",
    "descripcion": "¿Se utiliza una solución de CDE y flujo de trabajo para gestionar la información durante la gestión de activos y el desarrollo del proyecto?"
  },
  {
    "role": "adjudicatario_principal",
    "norma": "19650-1",
    "item": "12.2",
    "titulo": "El estado \"Trabajo en Curso\"",
    "descripcion": "¿Esta habilitado en el CDE el espacio WIP para cada equipo de trabajo?"
  },
  {
    "role": "adjudicatario_principal",
    "norma": "19650-1",
    "item": "12.3",
    "titulo": "Transición control/revisión/aprobación",
    "descripcion": "¿Están previstos los flujos de revisión y aprobación de la información para su cambio de estado?"
  },
  {
    "role": "adjudicatario_principal",
    "norma": "19650-1",
    "item": "12.4",
    "titulo": "El estado \"Compartido\"",
    "descripcion": "¿Está habilitado en el CDE el espacio SHA  para permitir el trabajo colaborativo dentro del equipo de desarrollo asegurando la visibilidad de los contenedores de información pero no su edición? ¿Se ha compartido con el Adjudicador la información que requiera de su aprobación?"
  },
  {
    "role": "adjudicatario_principal",
    "norma": "19650-1",
    "item": "12.5",
    "titulo": "Transición revisión/autorización",
    "descripcion": "¿Se han comparado los contendores de información con los requerimentos de información establecidos por el cliente para asegurar su coordinación, integridad y precisión?"
  },
  {
    "role": "adjudicatario_principal",
    "norma": "19650-1",
    "item": "12.6",
    "titulo": "El estado \"Publicado\"",
    "descripcion": "¿Está previsto el espacio para almacenar la información que ha sido autorizada para su uso?"
  },
  {
    "role": "adjudicatario_principal",
    "norma": "19650-1",
    "item": "12.7",
    "titulo": "El estado \"Archivado\"",
    "descripcion": "¿Está previsto el espacio para mantener un registro de todos los CI que se han compartido y publicado durante el proceso de gestión de la información?"
  },
  {
    "role": "adjudicatario_principal",
    "norma": "19650-2",
    "item": "5.1.7",
    "titulo": "Establecer el entorno común de datos (CDE) del proyecto.",
    "descripcion": "¿Establece, implementa, configura y apoya un CDE del proyecto bien de forma directa o a través de un tercero?\n¿Asigna a cada CI (Contenedor de información) un identificador único basado en un convenio acordado y documentado compuesto por campos separados por un delimitador?\n¿Asigna a cada campo un valor determinado con arreglo a una norma de codificación acordada y documentada?\n¿Asigna a cada CI los atributos de idoneidad, revisión y clasificación de acuerdo con la norma ISO 12006-2?\n¿Pueden los CI cambiar de estado?"
  },
  {
    "role": "adjudicatario_principal",
    "norma": "19650-2",
    "item": "5.3.1",
    "titulo": "Presentación de ofertas. Designación de los responsables de la gestión de la información.",
    "descripcion": "¿Cuenta el adjudicatario principal con personas para desempeñar la función de gestión de la información directamente o con terceros?"
  },
  {
    "role": "adjudicatario_principal",
    "norma": "19650-2",
    "item": "5.3.2",
    "titulo": "Establecer el plan de ejecución del BIM del equipo de desarrollo (antes de la adjudicación).",
    "descripcion": "¿Se elabora un PRE-BEP en el que al menos tenga en cuenta los siguientes aspectos?\nNombres y CV profesional de las personas que desempeñarán la función de gestión de la información en nombre del equipo de desarrollo;\nla estrategia de entrega de la información; \nla estrategia de federación propuesta;\nla matriz de responsabilidades de alto nivel del equipo de desarrollo;\ncualquier propuesta para añadir o modificar métodos y procedimientos de producción de la información si procede; \ncualquier propuesta para añadir o modificar la norma de información del proyecto y,\nla lista de programas informáticos, software e IT que el equipo de desarrollo se propone utilizar"
  },
  {
    "role": "adjudicatario_principal",
    "norma": "19650-2",
    "item": "5.3.3",
    "titulo": "Evaluación de las capacidades y aptitudes del equipo de trabajo.",
    "descripcion": "¿Ha hecho cada equipo de trabajo una evaluación de su aptitud y capacidad de proporcionar información de conformidad con los requisitos del intercambio de información del adjudicador y en el plan de ejecución del BIM propuesto por el equipo de desarrollo (antes de la adjudicación). Cada equipo de trabajo debe tener en cuenta los siguientes elementos:\na) las aptitudes y capacidades del equipo de trabajo para gestionar la información, basadas en:\n– la experiencia pertinente y el número de miembros del equipo de trabajo que han gestionado la información de acuerdo con la estrategia de entrega de información propuesta, y\n– el currículum académico y la formación pertinentes de los miembros del equipo de trabajo;\nb) las aptitudes y capacidades del equipo de trabajo para producir la información, basadas en:\n– la experiencia pertinente y el número de miembros del equipo de trabajo que han producido información de acuerdo con los métodos y procedimientos de producción de información del proyecto, y\n– el currículum académico y la formación pertinentes de los miembros del equipo de trabajo;\nc) las tecnologías de la información (TI) disponibles en el equipo de trabajo, basadas en:\n– la lista de tecnologías de la información propuesta,\n– las especificaciones y la cantidad de hardware del equipo de trabajo,\n– la arquitectura, la capacidad máxima y el uso actual de la infraestructura de TI del equipo de trabajo, y\n– los acuerdos de soporte y de nivel de servicio asociados de que dispone el equipo de trabajo"
  },
  {
    "role": "adjudicatario_principal",
    "norma": "19650-2",
    "item": "5.3.4",
    "titulo": "Establecer las aptitudes y capacidades del equipo de desarrollo.",
    "descripcion": "¿La propuesta del adjudicatario principal es un resumen de la suma de las aptitudes y capacidades de las evaluaciones realizadas por cada equipo de trabajo?"
  },
  {
    "role": "adjudicatario_principal",
    "norma": "19650-2",
    "item": "5.3.5",
    "titulo": "Establecer el plan de movilización del equipo de desarrollo.",
    "descripcion": "¿El plan de movilización propuesto contempla al menos los siguientes puntos?\n- supervisión y documentación de los métodos y procedimientos propuestos para la producción de información;\n- control del intercambio de información entre los equipos de trabajo;\n- control de las entregas de información al adjudicador;\n- configuración y prueba del CDE;\n- adquisición, implementación de software, Hardware e IT;\n- desarrollo de recursos compartidos;\n- impartición de formación y proporcionar capacitación;\n- contratación de miembros adicionales, así como apoyo a las personas y organizaciones que se incorporen al equipo de desarrollo."
  },
  {
    "role": "adjudicatario_principal",
    "norma": "19650-2",
    "item": "5.3.6",
    "titulo": "Establecer el cuadro de riesgos del equipo de desarrollo.",
    "descripcion": "¿Se realiza un cuadro de riesgos del equipo de desarrollo que contenga los riesgos asociados con la puntualidad en la entrega en plazo de la información de conformidad con el EIR del adjudicador y la forma en la que el equipo de desarrollo se propone gestionar dichos riesgos?"
  },
  {
    "role": "adjudicatario_principal",
    "norma": "19650-2",
    "item": "5.3.7",
    "titulo": "Recopilar la información de la oferta del equipo de desarrollo.",
    "descripcion": "¿Se recopila en el PRE-BEP el resumen de las evaluaciones de aptitudes y capacidades, el plan de movilización y la evaluación de riesgos para ser incluidos en la oferta del equipo de desarrollo?"
  },
  {
    "role": "adjudicatario_principal",
    "norma": "19650-2",
    "item": "5.4.1",
    "titulo": "Adjudicación.Confirmar el plan de ejecución del BIM del equipo de desarrollo",
    "descripcion": "¿Se confirma el plan de ejecución BIM del equipo de desarrollo con cada uno de adjudicatarios?\n¿Esta confirmación contempla?:\nnombre de las personas que gestionarán la información;\nactualizar, si es preciso, la estrategia de entrega;\nactualizar, si es preciso, la matriz de responsabilidades;\nlos métodos y procedimientos de producción de la información;\nla lista de software, hardware e IT a utilizar?"
  },
  {
    "role": "adjudicatario_principal",
    "norma": "19650-2",
    "item": "5.4.2",
    "titulo": "Establecer la matriz detallada de responsabilidades del equipo de desarrollo",
    "descripcion": "¿Mejora el adjudicatario principal la matriz de responsabilidades de alto nivel en los siguientes aspectos?\nlos hitos de entrega de la información;\nla matriz de responsabilidades de alto nivel; \nlos métodos y procedimientos de producción de la información;\nlos elementos de la estructura de descomposición de contenedores de información asignados a cada equipo de trabajo o las dependencias del proceso de producción de la información"
  },
  {
    "role": "adjudicatario_principal",
    "norma": "19650-2",
    "item": "5.4.3",
    "titulo": "Establecer los requisitos del intercambio de información del adjudicatario principal",
    "descripcion": "¿Se han definido los EIR con cada uno los adjudicatarios en términos de?\nEstablecimiento del nivel de información necesario para satisfacer dichos requisitos;\nlos criterios de aceptación para cada requisito de información, \nlas fechas de cumplimiento y la información de apoyo que pueda ser necesaria para su cumplimiento"
  },
  {
    "role": "adjudicatario_principal",
    "norma": "19650-2",
    "item": "5.4.5",
    "titulo": "Establecer programa general de desarrollo de la información.",
    "descripcion": "¿Se establece un MIDP a partir de los TIDP de cada uno los equipos de trabajo?\n¿Se asegura que el MIDP contenga al menos?\nlas responsabilidades definidas en la matriz detallada de responsabilidades;\nlos predecesores o dependencias entre equipos de trabajo;\nlos plazos de revisión y autorización por parte del adjudicatario principal;\nlos plazos de revisión y aprobación por parte del adjudicador.\n¿Hecho esto se aseguran al menos los siguientes puntos?\nreferencian los entregables y las fechas dentro del documento;\ninformar a cada equipo de trabajo y notificarles cualquier cambio necesario en el TIDP;\ninformar al adjudicador de cualquier riesgo que pueda afectar a la entrega de la información del proyecto"
  },
  {
    "role": "adjudicatario_principal",
    "norma": "19650-2",
    "item": "5.4.7",
    "titulo": "Completar los documentos de adjudicación del adjudicatario.",
    "descripcion": "¿Se asegura que al menos los siguientes documentos forman parte de los documentos de contratación con cada adjudicatario?\n- EIR del adjudicatario principal;\n- norma de información del proyecto;\n- protocolo de información del proyecto;\n- BEP del equipo de desarrollo y TIDP acordado\n¿Se tiene una gestión de control de cambios durante toda la contratación?"
  },
  {
    "role": "adjudicatario_principal",
    "norma": "19650-2",
    "item": "5.5.1",
    "titulo": "Movilizar recursos",
    "descripcion": "¿Se confirma la disponibilidad de recursos de cada equipo de trabajo, se establecen los recursos para desarrollar e impartir formación sobre los requisitos de intercambio de formación, los hitos y la capacitación a los miembros del equipo de desarrollo?"
  },
  {
    "role": "adjudicatario_principal",
    "norma": "19650-2",
    "item": "5.5.2",
    "titulo": "Movilizar la tecnología de la información",
    "descripcion": "Ante un proyecto ¿Se movilizan los recursos necesarios para adquirir, configurar y probar el hardware, software y la infraestructura de TI necesaria?\n¿Se realizan pruebas de configuración y conectividad del CDE con el equipo de desarrollo del adjudicador?  \n¿Se realizan pruebas de intercambio de información entre los equipos de trabajo?"
  },
  {
    "role": "adjudicatario_principal",
    "norma": "19650-2",
    "item": "5.5.3",
    "titulo": "Probar los métodos y procedimientos de producción de información del proyecto",
    "descripcion": "¿Se pone a prueba, documentan y posteriormente se comunican a todos los equipos de trabajo los métodos y procedimientos de producción de información del proyecto?\n¿Se verifica que la estructura de distribución de CI es viable?\n¿Además de lo anterior, se desarrollan recursos compartidos para su uso por el equipo de desarrollo?"
  },
  {
    "role": "adjudicatario_principal",
    "norma": "19650-2",
    "item": "5.7.2",
    "titulo": "Revisar y autorizar el modelo de información.",
    "descripcion": "¿Realiza el adjudicatario principal una revisión del modelo de acuerdo con los métodos y procedimientos de producción de información, fijando especial atención al EIR del adjudicador y suya propia, y que se cumplen los criterios de aceptación y nivel de información para cada requisito de información?"
  },
  {
    "role": "adjudicatario_principal",
    "norma": "19650-2",
    "item": "5.8.2",
    "titulo": "Recoger las lecciones aprendidas para futuros proyectos",
    "descripcion": "¿Colabora el adjudicatario principal en la recopilación de las lecciones aprendidas del adjudicador?"
  },
  {
    "role": "adjudicatario",
    "norma": "19650-1",
    "item": "7.2",
    "titulo": "Función de gestión de la información de activos",
    "descripcion": "¿Se entrega dentro de la información clave de cualquier proyecto la referida a las operaciones y mantenimiento del activo?"
  },
  {
    "role": "adjudicatario",
    "norma": "19650-1",
    "item": "7.4",
    "titulo": "FUNCIONES DE LA GESTIÓN DE LA INFORMACIÓN DE TAREAS",
    "descripcion": "¿Se asignan funciones de gestión de la información a cada equipo de trabajo en el caso de equipos de desarrollo con múltiples equipos de trabajo, y esta gestión no solo se ocupa de información asociada con la tarea sino también con el requisito de coordinación de la información a través de múltiples tareas?"
  },
  {
    "role": "adjudicatario",
    "norma": "19650-1",
    "item": "10.1",
    "titulo": "Planificación del desarrollo de la información. Principios.",
    "descripcion": "¿Desarrolla el adjudicatario principal y los adjudicatarios la planificación del desarrollo de la información en respuesta a los requisitos de información del adjudicador, en términos de cómo cumplir con los requisitos definidos en el AIR o EIR; cuando se entregará la información en relación con los hitos del proyecto; como se coordinará la información con la de otro adjudicatario relevante; que información se va a desarrollar; quién será el responsable de desarrollarla y quién será el destinatario de ella?\n¿La planificación refleja el alcance de la contratación a lo largo del ciclo de vida del activo?\n¿Se desarrolla parte de esta planificación antes de la contratación para ser revisada por el adjudicador?\n¿Se tiene en cuenta que cada contenedor de información esté vinculado con uno o más requisitos de información predefinidos?"
  },
  {
    "role": "adjudicatario",
    "norma": "19650-1",
    "item": "10.2",
    "titulo": "Calendario de Desarrollo de la información.",
    "descripcion": "¿Se ha definido un programa de desarrollo de la información para todo el proyecto, o para la gestión de activos a corto o medio plazo de acuerdo con el cronograma y la contratación de las partes?\n¿Se ha definido un calendario de entrega de información dentro de cada programa?"
  },
  {
    "role": "adjudicatario",
    "norma": "19650-1",
    "item": "10.3",
    "titulo": "Matriz de responsabilidad",
    "descripcion": "¿Se genera una matriz de responsabilidades como parte del proceso de planificación de desarrollo de la información con uno o más niveles de detalle?"
  },
  {
    "role": "adjudicatario",
    "norma": "19650-1",
    "item": "10.4",
    "titulo": "Definición de la estrategia de federación y estructura de distribución de los contenedores de información",
    "descripcion": "¿Se define y acuerda colaborativamente la estrategia de federación y la descomposición estructural del proyecto? \n¿La estrategia de federación refleja cómo se relacionan las estructuras de contenedores de información descompuestas?\n¿Se han establecido referencias cruzadas entre los contenedores de información y los equipos de trabajo dentro de la estructura de distribución de los contenedores de información?\n¿Se ha comunicado a todas las organizaciones involucradas en las actividades del proyecto la estrategia de federación y la estructura de distribución de los contenedores de información?\n¿Se tiene en cuenta en su realización el enfoque estratégico del desarrollo del proyecto y la gestión de activos?\n¿Se tiene en cuenta los niveles de información como la cantidad mínima de información necesaria para satisfacer cada requisito relevante?"
  },
  {
    "role": "adjudicatario",
    "norma": "19650-1",
    "item": "11.2",
    "titulo": "Nivel de información necesario",
    "descripcion": "¿Se tiene en cuenta los niveles de información como la cantidad mínima de información necesaria para satisfacer cada requisito relevante?"
  },
  {
    "role": "adjudicatario",
    "norma": "19650-1",
    "item": "11.3",
    "titulo": "Calidad de la información",
    "descripcion": "¿Se ha acordado la información del CDE en términos de formato de información, formato de entrega, estructura del modelo de información, los medios para estructurar y clasificar la información y los nombres de los atributos para metadatos?\n¿Se tiene en cuenta que la clasificación de los objetos debería estar de acuerdo con los principios de la norma ISO 12006-2 y la información del objeto a la ISO 12006-3?"
  },
  {
    "role": "adjudicatario",
    "norma": "19650-1",
    "item": "12.1",
    "titulo": "Solución de entorno común de datos (CDE) y flujo de trabajo. Principios.",
    "descripcion": "¿Se utiliza una solución de CDE y flujo de trabajo para gestionar la información durante la gestión de activos y el desarrollo del proyecto?\n¿Se almacenan los CI dentro de CDE en alguno de estos tres estados: trabajo en curso (WIP); compartido (SHA) o publicado (PUB)?\n¿Se tiene en cuenta que cada CI administrado en el CDE debería tener los metadatos de código de revisión, de acuerdo con una norma acordada, por ejemplo, la IEC 82045-1, y un código de estado para indicar el uso o usos permitidos de la información?\n¿Se tienen en cuenta durante en la planificación del desarrollo de los Modelos PIM durante la fase de diseño y construcción los requisitos de transferencia de información del PIM al AIM al finalizar la construcción del activo?\n¿Se guardan el resto de los contenedores, incluidos los \"archivados\" para facilitar su consulta posterior?"
  },
  {
    "role": "adjudicatario",
    "norma": "19650-2",
    "item": "5.3.3",
    "titulo": "Evaluación de las capacidades y aptitudes del equipo de trabajo.",
    "descripcion": "¿El equipo de trabajo ha realizado una evaluación de su aptitud y capacidad para gestionar y proporcionar la información de acuerdo con los requisitos del EIR del adjudicador y del PRE-BEP propuesto por el equipo de desarrollo?\n¿Se ha evaluado estas aptitudes y capacidades en términos de?\nexperiencia de los miembros del equipo que han gestionado información de acuerdo con la estrategia de entrega de la información propuesta;\nCV;\naptitudes y capacidades para producir la información;\nlas tecnologías que tenga el equipo disponible y los posibles acuerdos de soporte y servicios de los que disponga"
  },
  {
    "role": "adjudicatario",
    "norma": "19650-2",
    "item": "5.4.4",
    "titulo": "ESTABLECER EL/LOS PROGRAMA/S DE DESARROLLO DE INFORMACIÓN DE UNA TAREA",
    "descripcion": "¿Se establece y se mantiene a lo largo de todo el periodo de contratación un programa de desarrollo de información de tareas (TIDP)? \n¿Se asegura que este TIDP enumera e identifica, para CI, al menos estos elementos?\nnombre y función;\nlas predecesoras y las dependencias;\nel nivel de información necesario;\nel tiempo estimado de realización;\nel autor y los hitos de entrega"
  },
  {
    "role": "adjudicatario",
    "norma": "19650-2",
    "item": "5.6.1",
    "titulo": "COMPROBAR LA DISPONIBILIDAD DE LA INFORMACIÓN DE REFERENCIA Y DE LOS RECURSOS COMPARTIDOS",
    "descripcion": "¿Antes de comenzar el trabajo se comprueba que se tiene acceso a toda la información de referencia y a los recursos compartidos del CDE?\n¿En caso contrario, se informa al adjudicatario principal y en su caso se hace una estimación del impacto de esta no disponibilidad en los hitos de entrega y en el TIDP?"
  },
  {
    "role": "adjudicatario",
    "norma": "19650-2",
    "item": "5.6.2",
    "titulo": "PRODUCIR INFORMACIÓN",
    "descripcion": "¿Se asegura que todos los equipos de trabajo conocen su TIDP, métodos, norma y procedimientos del proyecto?\n¿Se verifica que la información producida no exceda el nivel necesario o tenga detalles innecesarios, sea redundante con otros equipos de trabajo o se extienda más allá de la división de estructura del modelo que le corresponde?\n¿Se coordina toda la información y se compara con la información de partida en el CDE de conformidad con los métodos y procedimientos de producción de la información?\n¿Se verifica que la coordinación de los modelos geométricos se hace con respecto a aquellos que tienen el código de idoneidad adecuados dentro del CDE?"
  },
  {
    "role": "adjudicatario",
    "norma": "19650-2",
    "item": "5.6.3",
    "titulo": "REALIZAR UN CONTROL DE CALIDAD",
    "descripcion": "¿Se realiza un control de calidad de cada CI de acuerdo con la norma y los métodos y procedimientos del proyecto antes de pasar a la fase de revisión y aprobación de la información, registrando el resultado del control?\n¿Se comprueba que el CI está de acuerdo con la norma de información del proyecto?\n¿En caso de detectar un fallo durante el control y por tanto rechazar el CI, se informa al autor de la información de este resultado y de la acción correctiva requerida?"
  },
  {
    "role": "adjudicatario",
    "norma": "19650-2",
    "item": "5.6.4",
    "titulo": "REVISAR Y APROBAR EL INTERCAMBIO DE INFORMACIÓN",
    "descripcion": "¿Se revisa la información antes de compartirla en CDE del proyecto, rechazándolo en caso de no conformidad?\n¿A los CI se les asigna un código de idoneidad en caso de que todo esté correcto o se registra la causa de no conformidad o las modificaciones que haya que hacer en caso negativo?"
  },
  {
    "role": "adjudicatario",
    "norma": "19650-2",
    "item": "5.6.5",
    "titulo": "REVISAR EL MODELO DE INFORMACIÓN",
    "descripcion": "¿Se realiza una revisión del modelo teniendo en cuenta los métodos requerimientos y de producción del proyecto, y en especial considerando los requerimientos y criterios de aceptación del adjudicador y de los CI enumerados en el MIDP?"
  },
  {
    "role": "adjudicatario",
    "norma": "19650-2",
    "item": "5.7.1",
    "titulo": "PRESENTAR AL ADJUDICATARIO PRINCIPAL EL MODELO DE INFORMACIÓN PARA SU AUTORIZACIÓN",
    "descripcion": "¿Es conocedor el equipo de trabajo que el modelo de información deber ser entregado al adjudicatario principal para su autorización dentro del CDE antes de su entrega al adjudicador?"
  },
  {
    "role": "adjudicatario",
    "norma": "19650-2",
    "item": "5.8.2",
    "titulo": "Recoger las lecciones aprendidas para futuros proyectos",
    "descripcion": "¿Colabora el adjudicatario principal en la recopilación de las lecciones aprendidas del adjudicador?"
  }
] satisfies DefaultRequirementTemplate[];
