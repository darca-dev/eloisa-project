# Tareas 015 - Recuperación de fidelidad visual del shell Hospital

> As-built: `[x]` = verificado presente el 2026-08-25. `[ ]` = límite conocido.

## Implementado

### Marca y shell (H-FID-B, `fc9aa26`)

- [x] Corazón canónico `/brand/corazon-check.png` junto a «Eloisa» en el sidebar
- [x] Corazón decorativo: `alt=""` y `aria-hidden="true"`, sin duplicar el nombre anunciado
- [x] Asset reutilizado sin copiar, editar, renombrar ni crear variante
- [x] Logo institucional en ranura propia, dibujado solo si la institución lo aporta
- [x] `metadatoInstitucional` compone `tipo · municipio` en las cuatro combinaciones sin dejar `·`, espacio ni nodo vacío
- [x] Topbar compactado solo con medidas CSS: `.topbar`, `.profile`, `.profileAvatar`
- [x] `Cambiar sesión` y `Cerrar sesión` conservan handlers y `disabled` durante la operación
- [x] Campana, badge y conteo `7` retirados sin sustituto: ni cero, ni placeholder, ni badge neutro
- [x] Reglas `.bell`, `.bellBadge` y `.navBadge` eliminadas de la hoja
- [x] Doce elementos de menú en su orden vinculante, en los tres estados
- [x] Estado activo con `aria-current="true"`, no solo color
- [x] Menú neutral sin sesión: `<li>` de texto, sin controlador, sin `href`, con bloqueo anunciado por texto
- [x] Isa ausente de toda superficie Hospital
- [x] Allowlist de navegación ampliada de forma quirúrgica en `e5880ab`: solo retirar la expectativa obsoleta, sin tocar el contrato de navegación

### Ficha de paciente (`c9a1195`)

- [x] Cabecera de ficha: iniciales, nombre y línea de resumen desde `HospitalDetalleDto`
- [x] Fila de clasificaciones prioritarias declaradas, sin inventar condiciones
- [x] Cuadrícula densa del expediente con valores del DTO
- [x] Bloque de historial presente y **sin ningún evento ni fecha inventada**
- [x] `Registros ELOISA` visible como procedencia real
- [x] Campos no modelados con `Información no disponible` y `aria-describedby` a la ayuda del diálogo
- [x] Copy técnico `No disponible en CORE-01` retirado
- [x] Diálogo con `role="dialog"`, `aria-modal`, `aria-labelledby`, cierre por `Escape` y por botón
- [x] Foco al panel al abrir y devolución al disparador al cerrar
- [x] Cero imports de `hospitalPopulationFixtures` en la vista de Pacientes

### Directorio de profesionales (`4843612`)

- [x] Tarjetas `<li>` con `<h3>` de nombre, profesión servida y estado del perfil
- [x] Estado del perfil escrito como texto dentro del badge; el color acompaña
- [x] Afiliación real compacta: tipo, estado y fechas declaradas
- [x] Calificación, zona, disponibilidad, pacientes asignados, citas de hoy y próxima cita **retiradas del contrato**, no ocultadas
- [x] Botón `Ver agenda del profesional` ausente; la agenda vive dentro del detalle existente
- [x] `Sin información registrada` sustituye a `No disponible en este módulo`
- [x] Copy visible sin `CORE`, `backend`, `API`, `demo` ni `prototipo`
- [x] Cliente, filtros, paginación, cancelación y estados 401/403/503 sin cambios

### Agenda y citas (`3c738c9`)

- [x] Solicitudes como tarjetas densas: distintivo de modalidad, paciente, momento y controles reales
- [x] `iconoDeModalidad` decorativo, siempre acompañado del texto de la modalidad
- [x] Citas como filas densas con fecha/hora, paciente, profesional, modalidad y estado servidos
- [x] Las tres acciones agrupadas al final de la fila
- [x] `Reprogramar` y `Rechazar con motivo` visibles, `disabled`, sin controlador y con `aria-describedby`
- [x] Contorno rojo de `Rechazar` recuperado sin habilitar la acción
- [x] `Asignar` conserva payload, `expectedVersion` interno, bloqueo de doble envío y refresco
- [x] `Preparar visita domiciliaria` intacta para `HOME + ASSIGNED`
- [x] Reglas CSS de bloques retirados eliminadas de la hoja y probado que no vuelven

### Barra de filtros de Reportes (`82e6467`)

- [x] Seis grupos, sus opciones, su orden y sus manejadores idénticos
- [x] `Población prioritaria` sigue siendo tres chips combinables con `aria-pressed`
- [x] Barra `position: sticky` con offset en variable única, `z-index: 20` y fondo opaco
- [x] Capas ordenadas: cabeceras de tabla 2, barra 20, panel modal 40
- [x] Tabs inmediatamente debajo con `margin-top: -6px`
- [x] Objetivo táctil base 44 px, densidad de escritorio 32 px desde 1024 px
- [x] `@media (pointer: coarse)` restituye 44 px en cualquier anchura
- [x] Hasta 767 px franja con desplazamiento controlado; desde 768 px rejilla de tres columnas; desde 1400 px seis columnas
- [x] Clases genéricas `.filtro*` intactas para el bloque de «Evidencias e institucional»

### Invariantes conservados en las cinco tareas

- [x] Cero cambios en API, Prisma, migraciones, RLS, tenancy y auditoría
- [x] Cero cambios en clientes de red, contratos DTO, endpoints, filtros y paginación
- [x] Cero cambios en sesión, cookies, CSRF, roles y permisos
- [x] Cero fixtures o fallback demostrativo ante vacío, carga, error o denegación
- [x] `prototype-claude/**` sin modificar

## Límites conocidos (no autorizados como trabajo)

- [ ] `H-FID-C` — purga general de copy técnico. Anunciada en `H-FID-A` §6 y `H-FID-B` §8, citada como fuera de alcance por seis Task Specifications, **nunca escrita ni implementada**
- [ ] Copy técnico residual en `hospitalAdministrationConfig.ts` (`:971`, `:981`, `:1388`) y `hospitalVirtualConfig.ts:101` — `:1695` es `'WhatsApp Business API'`, nombre de producto de terceros y no copy técnico del proyecto
- [ ] `hospitalProfessionalsConfig.ts:56` conserva `No disponible en el prototipo` porque lo consume Administración
- [ ] Configuración muerta en `hospitalConfig.ts`: `badge?` (`:46`), `novedades` (`:58`), `HOSPITAL_NOVEDADES_DEMO = 7` (`:64`), `:88` y `:123`. Nada de eso se renderiza
- [ ] El shell Hospital no usa `BrandLogo`: `HospitalSidebar.tsx:35` incrusta la ruta del asset, contradiciendo `BrandLogo.tsx:9-11`
- [ ] Sin trampa de foco ni `inert` en el diálogo de la ficha, pese a declarar `aria-modal="true"`
- [ ] `.sesionBoton` a `min-height: 34px` sin restitución en `@media (pointer: coarse)`
- [ ] Contraste de `.navItemBloqueado` (`opacity: 0.72`) sin medir; no hay herramienta de contraste en el repositorio
- [ ] Sin auditoría automática de accesibilidad: `axe` no está en el repositorio
- [ ] Sin pruebas visuales golden ni pixel diff; `H-FID-B` §8 las excluyó explícitamente
- [ ] Reportes sigue alimentada por fixtures (`HospitalReports.tsx:5`, `:13`, `:36`); compactar sus filtros no la acercó a datos reales
- [ ] Desviación de alcance en `c9a1195`: modificó `hospitalPatientsConfig.ts`, fuera de la allowlist, y no modificó `HospitalPatients.tsx`, que sí estaba
- [ ] Ninguna de las cinco tareas tiene auditoría en `reviews/`; el directorio se cerró el 2026-08-25
- [ ] Los handoffs exigidos por las tareas (mapa campo visible → propiedad DTO, evidencia de las cuatro combinaciones `tipo/municipio`, resultados de pruebas) no están registrados en el repositorio
- [ ] El acoplamiento estructural entre composición y origen de datos sigue igual: no se introdujo separación que impida repetir la degradación

## Verificación pendiente

- [ ] Instalar `node_modules` y ejecutar `npx vitest run --root apps/web src/features/hospital/hospitalShell.test.tsx src/features/hospital/hospitalNavegacion.test.tsx`
- [ ] Ejecutar `npx vitest run --root apps/web src/features/hospital/hospitalPatients.test.tsx src/features/hospital/hospitalPatientsClient.test.ts`
- [ ] Ejecutar `npx vitest run --root apps/web src/features/hospital/hospitalProfessionals.test.tsx src/features/hospital/hospitalProfessionalsClient.test.ts`
- [ ] Ejecutar `npx vitest run --root apps/web src/features/hospital/hospitalAgenda.test.tsx src/features/hospital/hospitalAgendaClient.test.ts src/features/hospital/hospitalOperaciones.test.tsx`
- [ ] Ejecutar `npx vitest run --root apps/web src/features/hospital/hospitalReportsVista.test.tsx`
- [ ] Ejecutar `npm run typecheck --workspace @merdn/web` y `eslint` sobre el ámbito
- [ ] Comprobar en navegador la adherencia real de la barra de Reportes y su comportamiento en 375, 768, 1024, 1280 y 1400 px
- [ ] Recorrer con teclado la ficha del paciente y confirmar si el foco sale del diálogo
- [ ] Medir el contraste de `.navItemBloqueado` y de los badges de estado
- [ ] Medir los objetivos táctiles reales del topbar en dispositivo táctil
- [ ] Comparar las cuatro superficies recuperadas contra `prototype-claude/Eligeme-Hospital.dc.html` y registrar el resultado
