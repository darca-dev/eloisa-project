# Tareas 008 - Agregados municipales protegidos

> As-built: `[x]` = verificado presente el 2026-08-25. `[ ]` = límite conocido.

## Implementado

### API — superficie y autorización

- [x] `GET /api/v1/municipality/population-summary`
- [x] `GET /api/v1/municipality/territory-summary`
- [x] Ninguna ruta acepta `tenantId`, municipio, identificador, filtro ni parámetro de consulta
- [x] `401` sin sesión institucional vigente; `403` sin rol `MUNICIPAL_VIEWER`
- [x] La cookie de autoinscripción de paciente NO autentica a Alcaldía
- [x] `MunicipalAggregateAccessGuard` compone `MunicipalViewerGuard` en lugar de duplicarlo
- [x] Fail-closed a `503` cuando el contexto de ejecución seguro no se confirma
- [x] `Cache-Control: private, no-store`, `Pragma: no-cache` y `Vary: Cookie` en las dos rutas
- [x] Contrato reflejado en OpenAPI, con prueba de contrato

### API — cálculo y privacidad

- [x] Supresión primaria: `0` exacto, `1`–`4` como `<5` con `value: null`, `>=5` exacto
- [x] Supresión complementaria por espacio de filas, con aritmética racional exacta sobre `bigint`
- [x] Modo conservador por encima de 96 átomos desconocidos, que publica menos y nunca más
- [x] Desempate determinista al elegir qué celda suprimir
- [x] Celdas con el mismo conjunto de átomos comparten estado de supresión
- [x] Las siete regiones son exclusivas; el resto `noneOfThree` no se publica
- [x] `60+` derivado de la fecha de nacimiento contra la fecha de corte, nunca de la pertenencia persistida
- [x] Jerarquía `Municipio → Urbana/Rural → Barrio o vereda canónico`
- [x] Nodo agregado de «Pendiente de normalización territorial», sin devolver el texto declarado
- [x] Cuatro sistemas de supresión independientes en territorio, uno por métrica
- [x] Cuatro métricas oficiales siempre `UNAVAILABLE` con `value: null`, imposibles de rellenar sin cambiar el tipo
- [x] Solo se seleccionan las columnas imprescindibles; dirección y texto libre no se leen siquiera
- [x] Solo se cuentan pacientes con `status: 'ACTIVE'`

### API — aislamiento y auditoría

- [x] Toda lectura dentro de `PrismaService.withTenant()`, más filtro explícito de `tenantId`
- [x] El tenant llega del principal institucional, nunca del navegador
- [x] Auditoría del acceso concedido en la MISMA transacción que sirve los datos
- [x] Auditoría de la denegación desde el guard, que el controlador no puede registrar
- [x] Un fallo al auditar no convierte una denegación en permiso
- [x] La correlación se valida contra `^[A-Za-z0-9_-]{1,64}$` antes de registrarse
- [x] No se registran credenciales, tokens, hashes, IP, cabeceras, cuerpos, SQL ni conteos

### Base de datos

- [x] Migración aditiva `20260822130000_municipality_core_01`
- [x] Enums `InstitutionalRole` e `InstitutionalIdentityStatus`
- [x] Tablas `institutional_identity` e `institutional_session`
- [x] RLS activa y una política por tabla contra `merdn_current_tenant()`
- [x] `merdn_runtime` sin privilegio de `DELETE`: una sesión se revoca, no se borra
- [x] CHECK de forma sobre hash y sal de la credencial y sobre el hash del token
- [x] Clave foránea compuesta `(identityId, tenantId)`: una sesión no cruza instituciones
- [x] `resourceId` relajado a NULL solo para los dos eventos de acceso agregado, acotado por CHECK
- [x] Rollback documentado en `ROLLBACK-municipality_core_01.sql`, no automático

### Identidad institucional (nació en esta capacidad)

- [x] Módulo `apps/api/src/institutional-auth/` creado en `4094e88`
- [x] Cookie institucional `HttpOnly`, con `SameSite` y `Secure` según topología
- [x] Token opaco solo en cookie; en la base solo su SHA-256
- [x] Credencial derivada con `scrypt`; nunca en claro, nunca en respuesta ni en log
- [x] Aprovisionamiento desde configuración del servidor, sin valor por defecto para el secreto
- [x] Límite de tasa en la apertura de sesión
- [x] Revocación explícita que conserva la fila para trazabilidad

### Web

- [x] Cliente tipado `municipalityAggregatesClient.ts`, única frontera de red de la feature
- [x] No envía tenant, municipio, filtro ni cuerpo; no guarda nada en el navegador
- [x] `401` y `403` se traducen igual a la interfaz
- [x] Nunca lanza: devuelve un desenlace tipado
- [x] Sin repliegue a fixtures ante ningún fallo
- [x] `useMunicipalityAggregate` con primer render siempre `cargando` y cancelación al desmontar
- [x] Estados accesibles `cargando` (`role="status"`), `no-autorizado` y `error` (`role="alert"`)
- [x] Vista Población conectada, con aviso permanente de la regla de supresión
- [x] Nota por tarjeta cuando el conteo está suprimido: «Grupo pequeño protegido»
- [x] Métricas oficiales pintadas como `—` con «Dato oficial no disponible», sin barra ni porcentaje
- [x] Vista Territorio conectada, con la adaptación de columnas aprobada en OD-03
- [x] Diagrama de intersecciones decorativo y oculto a tecnologías de asistencia; la lista es la representación canónica

## Límites conocidos (no autorizados como trabajo)

- [ ] Formulario de acceso institucional en la experiencia Alcaldía: hoy no existe ninguno en `apps/web/src/features/municipality/`, y sin cookie previa las dos vistas resuelven siempre en `no-autorizado`
- [ ] Conexión a datos reales de los once módulos restantes de Alcaldía (`inicio`, `programas`, `presupuesto`, `evidencias`, `furag`, `adres`, `cuidado`, `brechas`, `cuidadores`, `indicadores`, `reportes`)
- [ ] Retirada del bloque de fixtures de `poblacion` de `municipalityConfig.ts`, que sobrevive aunque la vista conectada ya no lo pinte
- [ ] Corrección de la docstring obsoleta de `apps/web/src/app/municipality/page.tsx:12`, que afirma que la experiencia no llama a la API
- [ ] Revisión del título de `municipalityPrivacidad.test.tsx:196`, que afirma que la feature no consulta red cuando sí lo hace a través de un `fetchImpl` inyectado
- [ ] Validación jurídica del umbral de supresión (OD-05, diferida)
- [ ] Definición aprobada de «registro completo» (OD-04, diferida) y las métricas de calidad que dependen de ella
- [ ] Protección frente a inferencia por comparación de respuestas tomadas en momentos distintos; hoy es riesgo residual declarado
- [ ] Límite de tasa y tiempo máximo de consulta en las dos rutas municipales
- [ ] Agregación en SQL en lugar de en memoria del proceso Node
- [ ] Fuentes oficiales externas: población total municipal, población objetivo, RLCPD y cobertura siguen declaradas `UNAVAILABLE` por diseño
- [ ] Identidades nominales: la credencial es compartida por rol y la auditoría no atribuye a una persona
- [ ] Exportación, búsqueda, filtros arbitrarios, drill-down y mapa: fuera de alcance declarado y no implementados
- [ ] Auditoría de Codex de esta capacidad: `reviews/` no contiene ningún `REVIEW-MUNICIPALITY-CORE-01`

## Verificación pendiente

- [ ] Instalar dependencias y ejecutar las pruebas unitarias: `suppression.test.ts`, `population-summary.test.ts`, `territory-summary.test.ts`
- [ ] Levantar PostgreSQL, aplicar migraciones y ejecutar `municipality.api.test.ts` y `municipality-aggregates.db.test.ts`, que hoy se saltan con `describe.skipIf(!puedeEjecutarse)`
- [ ] Ejecutar las pruebas web: `municipalityAggregatesClient.test.ts`, `MunicipalityPopulation.test.tsx`, `MunicipalityTerritory.test.tsx`, `municipalityPrivacidad.test.tsx`
- [ ] Confirmar el «API 300/300, Web 1095/1095» declarado en el mensaje del commit `4094e88`
- [ ] Reproducir en navegador el desenlace de `/municipality` sin cookie institucional, y comprobar si iniciar sesión desde `/hospital` con la credencial municipal produce una cookie utilizable en Alcaldía
- [ ] Medir el coste de las dos consultas con un tenant de volumen realista
- [ ] Revisar independientemente la corrección de `suppression.ts`, en particular el modo conservador por encima de 96 átomos desconocidos
