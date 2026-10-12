# Optimización de pruebas — 042

Base: d0be21e. Rama: chore/optimizar-pruebas-esenciales.

Inventario inicial: 1918 pruebas web/72 archivos; baseline 31 etapas/2626 casos.
Se retiraron 73 casos originales, enumerados con sus líneas originales, y se
conservan tres aserciones semánticas de dos de ellos en un caso específico nuevo.
Reducción neta verificada: 72 casos. Las cuatro suites pasan de 291 a 219 casos.
No cambia el producto ni test discovery. No se añaden skips o excludes.

Se conservan pruebas de autenticación/recuperación, API, RLS, auditoría,
concurrencia y E2E. En estas cuatro suites se conservan validación, filtros,
privacidad, acciones pendientes inertes, límites regulatorios, procedencia y
semántica accesible. Las otras 68 suites web no se han reducido.

## hospital/hospitalFinancial.test.tsx

- Línea original 81: «cada vista de H-01 a H-05 sigue montando su propio contenido». Regresión de otro módulo ya cubierta por su suite propia y navegación del shell.
- Línea original 108: «declara exactamente las seis agrupaciones aprobadas, en orden». Fidelidad literal a textos/catálogos/filas/cifras del fixture; se conservan montaje, lógica, semántica accesible y límites de datos del módulo.
- Línea original 119: «declara exactamente los quince destinos aprobados, en orden». Fidelidad literal a textos/catálogos/filas/cifras del fixture; se conservan montaje, lógica, semántica accesible y límites de datos del módulo.
- Línea original 167: «son los diez del apartado 7, en el orden exacto». Fidelidad literal a textos/catálogos/filas/cifras del fixture; se conservan montaje, lógica, semántica accesible y límites de datos del módulo.
- Línea original 204: «solo usa las seis categorías operativas aprobadas». Fidelidad literal a textos/catálogos/filas/cifras del fixture; se conservan montaje, lógica, semántica accesible y límites de datos del módulo.
- Línea original 321: «muestra los tipos y campos requeridos». Fidelidad literal a textos/catálogos/filas/cifras del fixture; se conservan montaje, lógica, semántica accesible y límites de datos del módulo.
- Línea original 345: «muestra categorías, campos y procedencia». Fidelidad literal a textos/catálogos/filas/cifras del fixture; se conservan montaje, lógica, semántica accesible y límites de datos del módulo.
- Línea original 406: «usa las modalidades y los estados aprobados de independientes». Fidelidad literal a textos/catálogos/filas/cifras del fixture; se conservan montaje, lógica, semántica accesible y límites de datos del módulo.
- Línea original 429: «representa el flujo completo aprobado». Fidelidad literal a textos/catálogos/filas/cifras del fixture; se conservan montaje, lógica, semántica accesible y límites de datos del módulo.
- Línea original 455: «declara el formulario de registro rápido con sus campos aprobados». Fidelidad literal a textos/catálogos/filas/cifras del fixture; se conservan montaje, lógica, semántica accesible y límites de datos del módulo.
- Línea original 475: «muestra ficha, documentos, compras, facturas, pagos e historial». Fidelidad literal a textos/catálogos/filas/cifras del fixture; se conservan montaje, lógica, semántica accesible y límites de datos del módulo.
- Línea original 510: «muestra cantidad, costos, recepción y los seis estados aprobados». Fidelidad literal a textos/catálogos/filas/cifras del fixture; se conservan montaje, lógica, semántica accesible y límites de datos del módulo.
- Línea original 529: «muestra resumen, movimientos, evidencias e historial». Fidelidad literal a textos/catálogos/filas/cifras del fixture; se conservan montaje, lógica, semántica accesible y límites de datos del módulo.
- Línea original 636: «las dos fuentes tienen representación en los fixtures». Fidelidad literal a textos/catálogos/filas/cifras del fixture; se conservan montaje, lógica, semántica accesible y límites de datos del módulo.
- Línea original 646: «los cinco estados están representados y la fecha se muestra». Fidelidad literal a textos/catálogos/filas/cifras del fixture; se conservan montaje, lógica, semántica accesible y límites de datos del módulo.
- Línea original 700: «ofrece las ocho categorías con dirección, fuente maestra y campos». Fidelidad literal a textos/catálogos/filas/cifras del fixture; se conservan montaje, lógica, semántica accesible y límites de datos del módulo.
- Línea original 995: «conserva las seis agrupaciones y los quince destinos». Repite un contrato comprobado por otro caso conservado de la misma suite.
- Línea original 1012: «mantiene el menú lateral de 224 px y oculta el botón». Inspección literal de medidas/selectores CSS; no comprueba reflow o interacción real.
- Línea original 1034: «conserva las seis agrupaciones y los quince destinos». Repite un contrato comprobado por otro caso conservado de la misma suite.

## hospital/hospitalAdministration.test.tsx

- Línea original 79: ««Membresías y servicios» ya no es una opción del menú». Repite un contrato comprobado por otro caso conservado de la misma suite.
- Línea original 196: «muestra los tres planes con valor, periodicidad, estado y versión». Fidelidad literal a textos/catálogos/filas/cifras del fixture; se conservan montaje, lógica, semántica accesible y límites de datos del módulo.
- Línea original 247: «muestra los seis servicios con precio, duración, profesional y cobertura». Fidelidad literal a textos/catálogos/filas/cifras del fixture; se conservan montaje, lógica, semántica accesible y límites de datos del módulo.
- Línea original 259: «reproduce el formulario «Crear membresía» con etiquetas asociadas». Fidelidad literal a textos/catálogos/filas/cifras del fixture; se conservan montaje, lógica, semántica accesible y límites de datos del módulo.
- Línea original 372: «conserva la composición y los fixtures del prototipo». Fidelidad literal a textos/catálogos/filas/cifras del fixture; se conservan montaje, lógica, semántica accesible y límites de datos del módulo.
- Línea original 435: «muestra las doce filas con código de personal, persona, rol, entidad y estado». Fidelidad literal a textos/catálogos/filas/cifras del fixture; se conservan montaje, lógica, semántica accesible y límites de datos del módulo.
- Línea original 461: «conserva buscador, filtros y las cuatro vinculaciones del listado». Fidelidad literal a textos/catálogos/filas/cifras del fixture; se conservan montaje, lógica, semántica accesible y límites de datos del módulo.
- Línea original 529: «la vista operativa «Profesionales» conserva su contenido aprobado». Regresión de otro módulo ya cubierta por su suite propia y navegación del shell.
- Línea original 547: «contempla los cinco tipos de personal sin clasificar a las personas del ejemplo». Fidelidad literal a textos/catálogos/filas/cifras del fixture; se conservan montaje, lógica, semántica accesible y límites de datos del módulo.
- Línea original 563: «mantiene interno, independiente, convenio y externo como relaciones distintas». Fidelidad literal a textos/catálogos/filas/cifras del fixture; se conservan montaje, lógica, semántica accesible y límites de datos del módulo.
- Línea original 584: «es una pestaña propia, separada de «Personal y accesos»». Repite un contrato comprobado por otro caso conservado de la misma suite.
- Línea original 591: «lee cada rol como «Puede acceder a» y «No puede acceder a», no como estructura técnica». Fidelidad literal a textos/catálogos/filas/cifras del fixture; se conservan montaje, lógica, semántica accesible y límites de datos del módulo.
- Línea original 644: «reproduce los once parámetros de agenda con sus valores demostrativos». Fidelidad literal a textos/catálogos/filas/cifras del fixture; se conservan montaje, lógica, semántica accesible y límites de datos del módulo.
- Línea original 657: «reproduce los nueve datos de la institución y la ranura de logo». Fidelidad literal a textos/catálogos/filas/cifras del fixture; se conservan montaje, lógica, semántica accesible y límites de datos del módulo.
- Línea original 690: «la Agenda y citas aprobada conserva su contenido». Regresión de otro módulo ya cubierta por su suite propia y navegación del shell.
- Línea original 801: «conserva los cinco eventos del prototipo con su composición». Fidelidad literal a textos/catálogos/filas/cifras del fixture; se conservan montaje, lógica, semántica accesible y límites de datos del módulo.
- Línea original 856: «el identificador de cada persona se llama «Código de personal»». Repite un contrato comprobado por otro caso conservado de la misma suite.
- Línea original 924: «las tablas se desplazan dentro de su contenedor y usan patrones flexibles». Inspección literal de medidas/selectores CSS; no comprueba reflow o interacción real.

## hospital/hospitalReportsVista.test.tsx

- Línea original 90: «los demás módulos siguen montando su propia vista». Regresión de otro módulo ya cubierta por su suite propia y navegación del shell.
- Línea original 118: «la barra global publica los seis filtros aprobados». Repite un contrato comprobado por otro caso conservado de la misma suite.
- Línea original 197: «la barra se fija con offset explícito, capa propia y fondo opaco». Inspección literal de medidas/selectores CSS; no comprueba reflow o interacción real.
- Línea original 211: «los tabs quedan inmediatamente debajo de la barra». Inspección literal de medidas/selectores CSS; no comprueba reflow o interacción real.
- Línea original 221: «la composición de escritorio es una sola franja de seis columnas». Inspección literal de medidas/selectores CSS; no comprueba reflow o interacción real.
- Línea original 228: «la densidad de escritorio baja los controles de 44 px a 32 px». Inspección literal de medidas/selectores CSS; no comprueba reflow o interacción real.
- Línea original 247: «en móvil y tableta hay adaptación explícita sin desbordamiento roto». Inspección literal de medidas/selectores CSS; no comprueba reflow o interacción real.
- Línea original 260: «los estilos genéricos de «Evidencias» no se rediseñan con la barra». Inspección literal de medidas/selectores CSS; no comprueba reflow o interacción real.
- Línea original 273: «el resumen «Filtros aplicados» y el motivo no reservan filas altas». Inspección literal de medidas/selectores CSS; no comprueba reflow o interacción real.
- Línea original 281: «el motivo de exportación queda fuera de la franja de acciones». Inspección literal de medidas/selectores CSS; no comprueba reflow o interacción real.
- Línea original 403: «los cinco tabs conservan su orden exacto». Repite un contrato comprobado por otro caso conservado de la misma suite.
- Línea original 459: «Resumen publica los seis KPI y la bandeja de atención». Fidelidad literal a textos/catálogos/filas/cifras del fixture; se conservan montaje, lógica, semántica accesible y límites de datos del módulo.
- Línea original 478: «Población publica la matriz completa, los rangos, patologías, EPS y programas». Fidelidad literal a textos/catálogos/filas/cifras del fixture; se conservan montaje, lógica, semántica accesible y límites de datos del módulo.
- Línea original 490: «Operación publica los seis KPI, los cinco gráficos y el resumen operativo». Fidelidad literal a textos/catálogos/filas/cifras del fixture; se conservan montaje, lógica, semántica accesible y límites de datos del módulo.

## municipality/municipalityPrograms.test.tsx

- Línea original 182: «conserva el shell, el selector temporal y el perfil». Regresión de otro módulo ya cubierta por su suite propia y navegación del shell.
- Línea original 213: «muestra el título y el subtítulo exactos del prototipo». Fidelidad literal a textos/catálogos/filas/cifras del fixture; se conservan montaje, lógica, semántica accesible y límites de datos del módulo.
- Línea original 247: «muestra los cinco programas iniciales, en su orden aprobado». Fidelidad literal a textos/catálogos/filas/cifras del fixture; se conservan montaje, lógica, semántica accesible y límites de datos del módulo.
- Línea original 264: «renderiza una tarjeta por programa, con su borde lateral de estado». Fidelidad literal a textos/catálogos/filas/cifras del fixture; se conservan montaje, lógica, semántica accesible y límites de datos del módulo.
- Línea original 272: «los programas son configuración, no una lista cerrada en el componente». Repite un contrato comprobado por otro caso conservado de la misma suite.
- Línea original 294: «declara exactamente las tres poblaciones base aprobadas». Fidelidad literal a textos/catálogos/filas/cifras del fixture; se conservan montaje, lógica, semántica accesible y límites de datos del módulo.
- Línea original 307: «el catálogo vive separado de la entidad Programa». Fidelidad literal a textos/catálogos/filas/cifras del fixture; se conservan montaje, lógica, semántica accesible y límites de datos del módulo.
- Línea original 390: «declara el catálogo exacto de cuatro orígenes». Fidelidad literal a textos/catálogos/filas/cifras del fixture; se conservan montaje, lógica, semántica accesible y límites de datos del módulo.
- Línea original 405: «los cuatro orígenes están representados entre los fixtures». Fidelidad literal a textos/catálogos/filas/cifras del fixture; se conservan montaje, lógica, semántica accesible y límites de datos del módulo.
- Línea original 416: «existe al menos un programa de origen no municipal, sin afirmar integración». Repite un contrato comprobado por otro caso conservado de la misma suite.
- Línea original 447: «declara los cuatro tipos de participación admitidos». Fidelidad literal a textos/catálogos/filas/cifras del fixture; se conservan montaje, lógica, semántica accesible y límites de datos del módulo.
- Línea original 456: «cada programa declara al menos un ejecutor». Fidelidad literal a textos/catálogos/filas/cifras del fixture; se conservan montaje, lógica, semántica accesible y límites de datos del módulo.
- Línea original 477: «ningún ejecutor está codificado dentro del componente». Repite un contrato comprobado por otro caso conservado de la misma suite.
- Línea original 488: «declara el catálogo exacto y cerrado de cinco estados, en su ciclo nominal». Fidelidad literal a textos/catálogos/filas/cifras del fixture; se conservan montaje, lógica, semántica accesible y límites de datos del módulo.
- Línea original 519: «todos los fixtures usan un estado del catálogo». Fidelidad literal a textos/catálogos/filas/cifras del fixture; se conservan montaje, lógica, semántica accesible y límites de datos del módulo.
- Línea original 549: «contiene exactamente los diez grupos de campos mínimos». Fidelidad literal a textos/catálogos/filas/cifras del fixture; se conservan montaje, lógica, semántica accesible y límites de datos del módulo.
- Línea original 793: «el ejemplo principal conserva 540 / 412 / 76 %». Fidelidad literal a textos/catálogos/filas/cifras del fixture; se conservan montaje, lógica, semántica accesible y límites de datos del módulo.
- Línea original 853: «el ejemplo principal conserva $680 M / $402 M / 59 %». Fidelidad literal a textos/catálogos/filas/cifras del fixture; se conservan montaje, lógica, semántica accesible y límites de datos del módulo.
- Línea original 959: «existe un programa finalizado con contrato de cierre completo». Fidelidad literal a textos/catálogos/filas/cifras del fixture; se conservan montaje, lógica, semántica accesible y límites de datos del módulo.
- Línea original 980: «presenta juntos los once datos exigidos». Fidelidad literal a textos/catálogos/filas/cifras del fixture; se conservan montaje, lógica, semántica accesible y límites de datos del módulo.
- Línea original 1126: «ninguna función condiciona su comportamiento a que el programa sea municipal». Repite un contrato comprobado por otro caso conservado de la misma suite.
- Línea original 1145: «Inicio, Población beneficiaria y Territorio siguen montando su vista». Regresión de otro módulo ya cubierta por su suite propia y navegación del shell.

## Cobertura conservada

La revisión independiente detectó que los casos originales de Administración
547/563 también comprobaban procedencia desconocida y límites laborales. Se
conservaron expresamente `tiposEstado = Por confirmar`, la ausencia de aplicación
de legislación laboral y la ausencia de cálculos de salario, honorarios,
seguridad social o retenciones. Solo se retiraron sus arrays y copias de catálogo.

- Finanzas: todos los destinos montan, filtros/bandejas, enmascaramiento,
  procedencia, datos desactualizados, duplicados/conflictos, integración bloqueada,
  acciones inertes, semántica modal/no modal y foco. El menú completo sigue
  comprobado en móvil; las comparaciones de markup idéntico de tableta/escritorio
  se retiran, manteniendo sus estados/selección/semántica específicos.
- Administración: navegación de todas las pestañas, revisor positivo/negativo,
  carga real sin SOL-DEMO, controles inertes, privacidad de credenciales,
  límites clínicos, ausencia de integraciones activas y accesibilidad. El nombre
  Código de personal sigue comprobado en el caso original de línea 454.
- Reportes: navegación de todos los tabs y paneles, filtros/limpieza, privacidad
  Hospital/Alcaldía, exportación deshabilitada, límites FURAG/ADRES/SENA/T319,
  metadata sin documento, carga/error, ausente distinto de cero y accesibilidad.
  Los grupos de filtros siguen comprobados por el caso original de línea 297;
  el orden de tabs por el de línea 148.
- Programas: validación de todos los campos, entradas múltiples, límites numéricos
  y temporales, borrador sin activación/persistencia, datos no derivados, porcentaje
  declarado, comprometido ausente, informe pendiente sin cumplimiento, privacidad,
  organización sin municipio, configuraciones alternativas y accesibilidad.

## Verificación

| Suite | Antes | Después |
|---|---:|---:|
| Finanzas Hospital | 80 | 61 |
| Administración Hospital | 75 | 58 |
| Reportes Hospital | 48 | 34 |
| Programas municipales | 88 | 66 |
| Cuatro suites revisadas | 291 | 219 |
| Web completa, mismos 72 archivos | 1918 | 1846 |
| Baseline completa, mismas 31 etapas | 2626 | 2554 |

Ejecución final `tests042-final-r1`: 2554 pruebas correctas, cero fallos y cero
omisiones; cleanup aislado correcto. Las 25 etapas PostgreSQL conservan sus
601 casos; todos los conteos ajenos a web coinciden con la baseline anterior.
Tipos, lint, scanner y diff-check correctos. Catálogo SQL: cuatro casos correctos.
No se reconstruyeron imágenes ni repitieron E2E porque el producto no cambió.

Revisión independiente: sin bloqueantes tras conservar las tres aserciones de
clasificación/límites laborales. Las claves del marcado SSR incluyen todas las
props fijas; estados, filtros, variantes de menú y configuraciones alternativas
se renderizan aparte. No hay mocks de servicios ni cache de resultados de API.

No se afirma que las otras 68 suites web sean mínimas ni se eliminan casos solo
para lograr un porcentaje. La mejora buscada es reducir mantenimiento y renders
idénticos. Los tiempos observados dependen de carga/caches; no constituyen un
benchmark ni una garantía de aceleración.

La entrega del producto quedó en `d0be21e`, rama
`feat/termino-01-registro-institucional`. El remoto configurado
`arvtechv/eloisa_project` responde Repository not found. Se confirmó acceso de
lectura a `eloisa-platform/Eloisa`; destino de publicación pendiente de respuesta
del PO. No se modifican main/develop ni se fusionan historias.
