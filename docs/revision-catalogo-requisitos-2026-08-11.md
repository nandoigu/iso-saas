# Revisión del catálogo de requisitos (11-ago-2026)

Revisión de las `RequirementTemplate` que hay hoy en la base de datos, previa a
cualquier decisión sobre el troceado de peticiones del componente de IA.

Fuente: rama `Test` de `BAOS-produccion-fra` (`ep-jolly-resonance-b2y3s9ni`, Frankfurt),
lectura del 11-ago-2026. Scripts de solo lectura: `scripts/dump-requirement-templates.mjs`
y `scripts/audit-requirement-templates.mjs`. Listado completo en
[`catalogo-requisitos-actual.md`](./catalogo-requisitos-actual.md).

---

## 0. Desenlace (mismo día, tras recibir la fuente autorizada)

El usuario aportó los tres Excel de `docs/fuentes/` como fuente autorizada. Comparados
contra la base, **los 92 requisitos de los tres roles reales coincidían carácter a
carácter**: la importación original no corrompió nada. Solo había una fila de más.

Aplicado y verificado contra la rama `Test`:

| Acción | Resultado |
|---|---|
| Borradas las 85 plantillas de rol `general` | ✅ |
| Borrada `adjudicatario \| 19650-2 \| 5.7.2` (no está en la fuente) | ✅ |
| Corregida la descripción de `adjudicador \| 19650-2 \| 5.2.2` | ✅ |
| Catálogo resultante | **91 plantillas**, 0 diferencias contra la fuente |
| `app/lib/defaultRequirementTemplates.ts` alineado con la fuente | ✅ 91 entradas |

Producción se ejecuta aparte con `scripts/sanear-catalogo-produccion.ps1`, porque las
escrituras a producción no se lanzan desde la sesión.

⚠️ **Corrección importante sobre la sección 3.3**: las erratas (`establcido`,
`recoplidado`, `especilamente`, `adjudicatorio`, `validad`, `contendores`,
`requerimentos`, `[J`) **están en los Excel de origen**, no las introdujo la
importación. Corregirlas exige corregir también la fuente, o volverán a entrar en la
siguiente carga. Queda pendiente de decisión del usuario.

⚠️ **Corrección sobre la sección 4.2**: de los dos apartados señalados, solo el
`5.7.2` era erróneo. El `5.8.2` sí figura en la fuente del rol `adjudicatario`: es
deliberado y la objeción no procedía.

---

## 1. Corrección de partida: ningún proyecto tiene 177 requisitos

177 es el tamaño del **catálogo global**, no lo que se carga en un proyecto.
`generateRequirementsForProject` (`services/requirement.service.ts:17`) filtra por
`role`, y `Project.role` no cambia tras la creación.

| Rol del proyecto | Requisitos que recibe | 19650-1 | 19650-2 |
|---|---|---|---|
| `adjudicador` | **38** | 21 | 17 |
| `adjudicatario_principal` | **35** | 17 | 18 |
| `adjudicatario` | **19** | 9 | 10 |
| `general` | **0** — nunca se asigna | 42 | 43 |
| | **177 en catálogo** | 89 | 88 |

Consecuencia directa sobre el análisis de coste del componente de IA: el
multiplicador del peor caso es **38**, no 177. La cifra de 177 quedó anotada en la
memoria del proyecto como "requisitos de un proyecto típico" y es incorrecta.

Salvedad: un proyecto puede recibir requisitos adicionales por importación de Excel
(`/api/projects/[id]/import-requirements`), que no pasa por el catálogo. El proyecto
`Hospital Laguna 2` que quedó en Londres tiene 86 requisitos, que no corresponde a
ninguna de las tres cifras de arriba.

---

## 2. Las 85 filas con rol `general` son datos huérfanos

`TemplateRole` solo admite tres valores (`services/template.service.ts:4`):
`adjudicador`, `adjudicatario_principal`, `adjudicatario`. `general` no es uno de
ellos. Estas 85 filas:

- **No se pueden asignar a ningún proyecto**: no hay proyecto con rol `general`.
- **No se pueden haber creado por el importador actual**: `detectRoleFromFileName`
  lanza error si el nombre del fichero no contiene un rol válido. Son residuo de una
  carga anterior.
- **Tienen el campo `descripcion` vacío las 85**: la pregunta está metida en el
  `titulo`. Es el 100% de las filas sin descripción del catálogo.
- **Contienen duplicados internos**: 7 apartados repetidos, hasta 6 filas para el
  mismo (`10.1` y `12.1` de 19650-1 tienen 6 filas cada uno; `10.4`, 5; `5.2.2`
  de 19650-2 y `11.1`, 3).

Duplican además, en versión troceada, el contenido de los tres roles reales.

**Decisión pendiente**: borrarlas, o convertirlas en la fuente buena y retirar las
otras. No se toca nada sin que lo confirmes.

---

## 3. Problemas de forma en las 92 filas que sí se usan

### 3.1 El orden de presentación es alfabético, no por apartado

La consulta ordena por `item` ascendente, que es un campo de texto: sale `10.2`,
`10.3`, `11.2`, `12.1`, `5.1`, `5.2`… El apartado 5 aparece después del 12 tanto al
generar los requisitos como en el listado. El documento adjunto va reordenado a mano
por apartado natural para poder revisarlo; la app **no** lo hace.

### 3.2 Títulos que no son títulos

- 83 filas del catálogo llevan la pregunta completa en el `titulo` (las 85 de
  `general` menos 2, que empiezan por otra palabra).
- 60 filas tienen títulos de más de 120 caracteres.
- Mayúsculas inconsistentes en los roles reales: `CALENDARIO DE DESARROLLO DE LA
  INFORMACIÓN` (adjudicador) frente a `Calendario de Desarrollo de la información.`
  (adjudicatario), mismo apartado 10.2.

### 3.3 Erratas y basura literal

| Texto en la base | Filas | Dónde |
|---|---|---|
| `[J` (basura de copiado, al final de la descripción) | 2 | adjudicador 19650-1, apartados 11.2 y 11.3 |
| `calendacio` (por *calendario*) | 1 | general 19650-1, 10.1 |
| `establcido` (por *establecido*) | 2 | adjudicador y general, 19650-2 5.2.3 |
| `recoplidado` (por *recopilado*) | 2 | adjudicador y general, 19650-2 5.2.4 |
| `especilamente` (por *especialmente*) | 2 | adjudicador y general, 19650-2 5.7.4 |
| `adjudicatorio` (por *adjudicatario*) | 2 | adjudicador 19650-1 6.3.3, y su copia |
| `validad` (por *valida*) | 2 | adjudicatario_principal 19650-1 6.3.3, y su copia |
| `contendores` / `requerimentos` | 2 | adjudicatario_principal 19650-1 12.5, y su copia |
| `diseñe técnico` (por *diseño técnico*) | 1 | general 19650-1, 10.1 |

Otras erratas vistas a ojo y no contabilizadas: `¿He presentado cada equipo de
trabajo…` (por *¿Ha…*), `¿Ha establcido`, `los requiisitos`.

**Por qué importa más de lo que parece**: estas preguntas se envían al modelo como
enunciado del requisito y acaban citadas en el informe de auditoría que firma un
auditor. Una errata en el título del hallazgo sale impresa en el PDF.

---

## 4. Posibles errores de contenido (a confirmar por ti)

No se ha comprobado contra el texto de la ISO 19650 —es material con copyright y no
está en el sistema—, así que esto son incoherencias internas del propio catálogo, no
un dictamen normativo.

**4.1 Descripción que no corresponde al título.**
`adjudicador | 19650-2 | 5.2.2` se titula *"Reunir la información de referencia y los
recursos compartidos"*, pero su descripción es *"¿Tiene definida el adjudicador, por
medio de conjuntos de requisitos, toda información que deberá aportar a lo largo del
ciclo de vida…"*, que es literalmente el texto de `adjudicador | 19650-1 | 6.3.1`.
Parece un pegado equivocado.

**4.2 Preguntas redactadas para otro rol.**
En el rol `adjudicatario`, los apartados `5.7.2` y `5.8.2` de 19650-2 preguntan por lo
que hace el **adjudicatario principal** (*"¿Realiza el adjudicatario principal una
revisión del modelo…"*, *"¿Colabora el adjudicatario principal en la recopilación de
las lecciones aprendidas…"*). Un auditor que audite a un adjudicatario se encuentra
preguntando por la conducta de otra parte.

**4.3 El mismo apartado en varios roles, con texto que ha derivado.**
16 apartados aparecen en más de un rol. En **13 de los 16 la descripción es distinta
entre roles**, y solo en 3 es idéntica. Que un apartado afecte a varias partes es
razonable; que la pregunta cambie sin criterio visible, no. Casos claros: `10.2`,
`10.3`, `10.4`, `11.2`, `11.3` y `12.1`, donde la versión del adjudicador está
recortada respecto a la del adjudicatario (le falta la segunda pregunta).

**4.4 Un requisito sin apartado desglosado.**
`general | 19650-1 | 9` es el único con apartado de un solo nivel.

---

## 5. Cobertura de la norma

El catálogo cubre **solo 19650-1 (89 filas) y 19650-2 (88 filas)**. No hay ninguna
plantilla de 19650-3 (fase de operación), 19650-4 (intercambio de información) ni
19650-5 (seguridad). Si el producto se presenta como auditoría ISO 19650 sin matizar,
el alcance real es parte 1 y parte 2.

Tampoco se identifica la edición: el campo `norma` guarda `19650-1`, no
`UNE-EN ISO 19650-1:2018`. Para un informe certificable, la edición debería constar.

---

## 6. Qué hay que decidir

1. **Las 85 filas `general`**: ¿se borran o se recuperan como fuente buena?
2. **Erratas y basura literal**: ¿se corrigen en la base directamente? Afecta también
   a los requisitos ya generados en proyectos existentes, que son copias del texto.
3. **Apartado 5.2.2 del adjudicador**: ¿cuál es la pregunta correcta?
4. **`5.7.2` y `5.8.2` del rol adjudicatario**: ¿se reescriben en primera persona del
   rol, o se retiran de ese rol?
5. **Divergencia entre roles en los 13 apartados compartidos**: ¿unificar texto, o es
   intencionado?
6. **Orden de presentación**: ¿se cambia a orden natural por apartado? Es un cambio de
   una línea en la consulta, pero afecta a lo que ve el usuario en la app.
7. **Cobertura y edición de la norma**: ¿se declara el alcance a partes 1 y 2, o se
   amplía?

Ninguna de estas correcciones se aplica sin tu confirmación explícita, y todas afectan
a contenido normativo, que por la regla de integridad de `CLAUDE.md` solo puede venir
de fuente autorizada: tú.
