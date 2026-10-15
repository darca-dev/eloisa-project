# Revisión del plan antes de la entrega

Fecha: 2026-10-15. Código revisado: `d1bf4340dc7972d517a398b71da29e26b8cb2445`.
Rama: `feat/completar-modulos-reales`. Publicado en `eloisa-platform/Eloisa`
antes de esta revisión, por instrucción del Product Owner. `main` y `develop`
conservan sus referencias previas.

## Dictamen

El proyecto todavía no cumple la entrega funcional integral del plan S00–S14.
El plan sí incluye los dominios estratégicos y una matriz de pruebas, pero falta
convertir buena parte de sus entregables en operaciones implementadas y
verificadas. La limpieza de pantallas y la captura administrativa 053 no cierran
por sí solas programas, documentos, finanzas, indicadores o reportes.

Hay dos cierres diferentes: terminar y entregar Configuración municipal 053;
y completar el proyecto integral. No deben anunciarse como la misma entrega.

## Estado comprobado

| Elemento | Estado al revisar |
|---|---|
| Git | Checkpoint `d1bf434` publicado; 053 identificado como trabajo en curso |
| Docker | Web `eloisa-hospital052`, API `eloisa-login050`, PostgreSQL e IdP saludables |
| Hospital052 | Limpieza aplicada; 877 casos y E2E previa documentados; seis módulos todavía pendientes |
| Alcaldía053 | Código de formularios/API/migración escrito; aún sin aplicar en Docker |
| Esquema | 25 migraciones y 30 modelos en código; la migración 053 no fue aplicada por este trabajo |
| Tipos/lint/secretos | Comprobados correctamente antes del checkpoint |
| Pruebas municipales web | 379 casos / 14 archivos correctos, sin omisiones |
| Contratos compartidos | 9 casos / 2 archivos correctos, sin omisiones |
| SDD | Gate: 0 errores, 19 advertencias históricas; validación estricta: 0 errores / 0 advertencias |
| Pruebas pendientes | PostgreSQL053, builds del candidato completo, E2E053 y baseline final del mismo SHA |

Las pruebas anteriores de 040/041/049/050/051/052 sirven como historial; no prueban
el candidato053. No se ejecutó una nueva baseline completa en esta revisión.

## Bloqueos y defectos que deben entrar al plan inmediato

| ID | Prioridad | Hallazgo y evidencia | Cierre exigido |
|---|---|---|---|
| PE-01 | Alta | La inscripción pública legada sigue creando Patient y, cuando está configurada la provisión de credenciales, crea cuenta/binding antes del proveedor, inventa el subject y continúa tras su fallo. `patient-enrollment.controller.ts:73`, `patient-enrollment.service.ts:210–307`. | Unificar o retirar la escritura legada sin aprobación. Fallo de proveedor nunca confirma cuenta operativa. Probar rollback/reintento, subject real y alta pendiente. |
| PE-02 | Alta | Patient-self resuelve solo Patient propio ACTIVE; no exige la solicitud PATIENT aprobada y vinculada a la cuenta exacta. `patient-self.service.ts:315`, `identity-access.service.ts:24`. | Verificar aprobación vigente en la transacción de lectura; pendiente/rechazado/revocado, otro binding y otro tenant denegados y auditados. |
| PE-03 | Alta | Cuidador con experiencia y relación activa alcanza `CaregiverLiquidationsDemo` en el flujo autenticado. `CaregiverAccessPortal.tsx:236–253`. | Retirar esos importes/registros del flujo real y conectar sus consultas autorizadas; liquidaciones reales solo con su dominio financiero. |
| PE-04 | Media | 053 acepta `null` en campos opcionales mediante `?? ''`, pero el editor llama `value.trim()`. Reproducción pura confirmó aceptación y TypeError. `municipality-management.ts:68`, `MunicipalitySettings.tsx:35`. | Rechazar todo valor presente no textual, incluidos null; prueba de contrato/cliente y edición posterior sin bloqueo. |
| PE-05 | Media | 053 fija el instante de autorización antes del bloqueo de cuenta; una espera puede cruzar la expiración. `municipality-management.service.ts:23–25`. | Revalidar con tiempo posterior al bloqueo y comprobarlo con barrera en PostgreSQL. |
| PE-06 | Alta para cierre | 053 carece de ejecución de pruebas DB, revisión final y despliegue; las pruebas web actuales no ejercitan el formulario en navegador. | Ejecutar permisos, CSRF, binding, RLS, conflicto concurrente y fallo de auditoría; después backup/migración/build/E2E. |
| PE-07 | Alta para entrega pública | `npm audit` reporta 2 críticas, 11 altas y 2 moderadas por dependencias. Los paquetes críticos reportados son next y proxy-addr. | Clasificar alcance directo/transitivo y exposición real, corregir versiones compatibles y repetir build/regresiones/audit. No usar `audit fix --force` sin revisión. |

PE-01/02/03 se confirman en el recorrido estático, sin afirmar una explotación en
la instancia activa. PE-01 depende parcialmente de configuración de proveedor;
la escritura legada de Patient es un problema separado. PE-05 requiere el ensayo
concurrente para cerrar su riesgo temporal. PE-04 sí se reprodujo sin escribir
datos: evidencia local ignorada `.tmp/delivery-null-validation.txt`.

El audit de dependencias es un reporte del árbol de paquetes, no prueba de
explotabilidad. Por ejemplo, el aviso Next.js para servidores Windows tiene
condiciones de plataforma; Docker web actual usa Linux. Deben revisarse también
los demás avisos que afecten la misma versión. Referencias primarias enlazadas
desde el reporte: [Next.js/AVIF](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4),
[proxy-addr](https://github.com/jshttp/proxy-addr/security/advisories/GHSA-jqcg-44mw-7w3h).
Resultado local: `.tmp/audit-delivery-20261015.json`.

## Qué falta por sección

| Sección | Lo existente | Pendiente para cumplir su cierre |
|---|---|---|
| S00 Base | Monorepo, Docker, runner aislado y controles RLS | Repetir baseline del candidato final y reproducir el arranque desde checkout limpio |
| S01 Accesos | Admin único, OIDC, aprobación, recuperación administrada y separación de entradas | PE-01/02, matriz negativa vigente y conciliación del legado; no está cerrada por tener login funcional |
| S02 Personas | Modelos y parte de los endpoints de vínculos/asignaciones | Altas/edición/archivo autorizados, verificación profesional y afiliaciones, interfaz de relaciones y consentimiento/revocación |
| S03 Alcaldía | Agregados reales y composición visual;053 en curso | Cerrar053 y probar edición persistente; programas relacionados con beneficiarios/cobertura y filtros de servidor según el contrato completo |
| S04 Evidencias | Referencias de soporte previstas en053 | Carga/descarga privada, tipos/tamaños, versiones, autorización por recurso e integridad; un enlace no sustituye almacenamiento documental |
| S05 Hospital | Pacientes/profesionales consultables, agenda/asignación y API de visitas/transiciones | Crear/reprogramar/cancelar citas, reglas horarias y conexión operativa profesional hasta cierre; probar recorrido completo |
| S06 Portales | Paciente consulta datos propios; profesional consulta worklist | Acciones/bitácoras persistentes según campos aprobados, lecturas delegadas del cuidador y retiro de PE-03; fuente clínica solo cuando esté autorizada |
| S07 Finanzas | Captura declarativa de montos en053, todavía no desplegada | Recursos/movimientos/contratos/proveedores/soportes relacionados, estados, ajustes, conciliación y reglas de aprobación |
| S08 Hub/indicadores | Enlaces oficiales y transcripción administrativa previstos | Relaciones entre marco, obligación, acción, evidencia e indicador; fórmulas/fuentes aprobadas y resultados reproducibles |
| S09 Formación | Enlaces SENA y captura agregada previstos | Inscripción/avance/soporte/verificación persistentes y autoridad verificadora definida |
| S10 Servicios/cobros | Referencias visuales históricas | Catálogo/tarifas/planes aprobados, prestación/cargo/conciliación manual/soporte reales; gateway sigue fuera sin autorización separada |
| S11 Virtuales | Modalidad VIRTUAL en citas, pantalla Hospital pendiente | Coordinación/enlace autorizado, participantes, asistencia/cierre y continuidad, sin simular videollamada |
| S12 Alertas/ayuda | Capacidades previstas y pantallas sin consulta | Eventos, reglas aprobadas, seguimiento/cierre, notificación y fallos de entrega; ninguna regla clínica inventada |
| S13 Reportes | Referencias a informes existentes previstas en053 | Generación/descarga real con datos autorizados, filtros, corte, fuente y conciliación con los registros |
| S14 Entrega | Runbooks y verificaciones anteriores disponibles | Recorridos integrales del mismo candidato, restore coordinado, imágenes identificadas, entorno de entrega y aceptación por módulo |

Las capacidades heredadas parciales no deben reimplementarse desde cero.
Las capturas manuales y enlaces son válidos para el alcance municipal solicitado,
pero no demuestran por sí mismos todos los resultados del plan integral.
No hace falta una API externa automática para entregar esas capturas y enlaces.

## Vacíos y contradicciones del plan de trabajo

1. **Estado desactualizado.** La cabecera antigua indicaba 23 migraciones y cupos
   libres; ya existen cuentas locales de revisión solicitadas por el PO y nuevas
   migraciones. Separar siempre esquema versionado, esquema aplicado e imagen
   servida. Los números de pruebas antiguos no se trasladan al candidato actual.
2. **Alcance de la entrega sin matriz firmada.** Hace falta una fila por operación
   entregable: actor, datos, resultado persistente, fuente, prueba y aceptación.
   Una tarjeta pendiente o un formulario de metadatos no cierra todo el dominio.
   No reducir los 33 dominios ni declarar cerrado el proyecto por la sola 053.
3. **Aprobación financiera incompatible con los roles actuales.** S07 exige
   creador/aprobador separados y permisos FIN, mientras el PO difirió nuevos
   empleados/roles. Definir el flujo permitido con el único administrador antes
   de implementar aprobaciones; no inventar un segundo usuario ni autoaprobación.
4. **Reglas de agenda pendientes.** Fijar zona horaria institucional, duración,
   solapamientos, reprogramación y cancelación. El día UTC de la consulta actual
   no sustituye ese contrato operativo completo.
5. **Fuentes y autoridad.** Documentar por campo si es dato canónico, declaración,
   transcripción externa o resultado calculado. Para el pedido actual bastan las
   páginas oficiales reales y captura trazable; cualquier importación automática
   posterior necesita su contrato. No copiar cifras del prototipo ni tratarlas
   como publicaciones verificadas.
6. **Campos y políticas por cerrar.** Completar los formularios/estados reales
   de profesional, cuidado, evidencia, formación y finanzas; definir retención,
   corrección y quién valida. Recuperación administrada ya está decidida: no
   reabrir SMTP como condición de entrega.
7. **Operación medible.** Elegir entorno de entrega, responsables de instalación,
   respaldo/restauración, tiempos objetivos de recuperación y procedimiento para
   cuentas de revisión. Su limpieza requiere instrucción concreta, no borrado
   automático durante una auditoría. Producción y pagos conservan autorización
   independiente.

## Orden de cierre recomendado

1. Cerrar PE-01/02 y el contenido ficticio todavía alcanzable; revisar dependencias
   con riesgo de release. Mantener Hospital052 estable mientras se verifica.
2. Corregir PE-04/05 y terminar 053: tests DB obligatorios sin skips, builds,
   revisión, backup, migración y E2E guardar→consultar→recargar con admin municipal.
3. Completar S02 y la cadena S05/S06: persona/profesional/vínculo→cita→asignación→
   visita→cierre consultable por actores autorizados.
4. Completar S03/S04 y después S07–S13 en su orden de dependencias, con reglas y
   campos concretos. Las referencias/manuales se entregan honestamente según su
   alcance, sin simular automatización ni calificaciones oficiales.
5. Ejecutar S14 sobre un único candidato: baseline y pruebas negativas verdes,
   restore DB/IdP/archivos ensayado, inventario de imágenes y aceptación del PO por
   capacidad. Publicar una release solo cuando corresponda su autorización.

## Condiciones objetivas de entrega

- [ ] Sin hallazgos altos abiertos del alcance ni éxitos ficticios.
- [ ] Operaciones acordadas persisten al recargar y tienen auditoría verificable.
- [ ] Otra cuenta, otro perfil, sesión revocada y tenant ajeno no acceden.
- [ ] Todos los datos muestran procedencia y corte; campos no registrados vacíos.
- [ ] API/web/DB/migraciones/evidencia corresponden al mismo candidato.
- [ ] Pruebas necesarias, builds, tipos, lint, scanner y revisión sin omisiones críticas.
- [ ] Backup y restauración coordinados; instalación y rollback reproducidos.
- [ ] Aceptación del Product Owner registrada por módulo y entorno acordado.

No se asigna fecha ni porcentaje de término sin cerrar primero alcance, reglas
pendientes y tamaño de los paquetes. Esta revisión no aplica migraciones, cambia
roles, borra datos ni despliega 053.
