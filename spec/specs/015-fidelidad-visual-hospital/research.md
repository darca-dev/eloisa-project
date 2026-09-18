# Investigación 015 - Recuperación de fidelidad visual del shell Hospital

Medido sobre `develop` el 2026-08-25. Cada hallazgo indica el comando o la ruta
que lo respalda. Lo que no se pudo comprobar está en R15.

## R1. La degradación es real y trazable en el historial de cada archivo

```text
git log --format="%h %ad %s" --date=short -- apps/web/src/features/hospital/HospitalProfessionals.tsx
```

Tres commits, y solo tres:

| Archivo | Nace (spec 003) | Se reescribe al conectar | Se recupera (esta spec) |
|---|---|---|---|
| `HospitalProfessionals.tsx` | `d465813` | `3d63154` (CORE-02, spec 010) | `4843612` |
| `HospitalPatientsPieces.tsx` | `701d5d4` | `30fb378` (CORE-01, spec 009) | `c9a1195` |
| `HospitalAgenda.tsx` | `2e1fe65` | `3d63154` y `31cd54c` (spec 013) | `3c738c9` |
| `HospitalReportsPieces.tsx` | `20cb5d3` | — nunca se conectó — | `82e6467` |

El patrón se sostiene en tres de los cuatro archivos: la composición aprobada y
el origen de los datos vivían en el mismo componente, y sustituir el origen
sustituyó la composición. `HospitalReportsPieces.tsx` rompe el patrón: no tiene
commit de conexión, luego su cambio no es una recuperación (ver R8).

## R2. `fc9aa26` — qué cambió exactamente en marca y topbar

```text
git show --stat fc9aa26
```

Seis archivos, todos dentro de la allowlist de `H-FID-B` §7. Los cambios
sustantivos:

- `HospitalSidebar.tsx` gana `HospitalPlatformBrand` (`:53-70`), que emite
  `/brand/corazon-check.png` con `alt=""` y `aria-hidden="true"`, y
  `metadatoInstitucional` (`:82-88`), que devuelve `null` cuando no hay nada que
  afirmar en lugar de dejar un `·` huérfano.
- `HospitalTopbar.tsx` **elimina** el componente `HospitalNotificationIndicator`
  completo, y con él el anuncio accesible `Novedades: ${novedades} sin leer`.
- `HospitalShell.tsx` deja de pasar `novedades` a la topbar (una sola línea
  borrada).
- `hospital.module.css` borra las reglas `.navBadge`, `.bell` y `.bellBadge`, y
  baja densidad: `.topbar` de `14px 26px` a `10px 22px`, `.profile` de
  `7px 14px 7px 7px` a `4px 12px 4px 4px`, `.profileAvatar` de 34 a 30 px,
  `.sesionBoton` de `min-height: 36px` a `34px`.

Verificación de ausencia hoy: `grep -n "bell\|navBadge" hospital.module.css` no
devuelve nada.

## R3. Qué es la «allowlist de navegación» de `e5880ab` y qué protege

```text
git show e5880ab
```

El commit no toca código: modifica `tasks/H-FID-B.md`. Añade un **sexto**
archivo a la allowlist cerrada —`hospitalNavegacion.test.tsx`— y acota su uso a
dos cosas:

1. retirar la expectativa `Novedades: 7 sin leer`;
2. actualizar la descripción heredada que exigía la campana.

Y añade la frase: «No puede usarse para cambiar orden, destinos, handlers,
permisos, estados activos, alcance de navegacion ni ninguna otra expectativa».
También corrige «si la implementacion requiere un sexto archivo» por
«un septimo».

Lo que protege es concreto. `hospitalNavegacion.test.tsx` es la suite que fija
el contrato de navegación de Hospital (20 casos, `grep -c "it("` → 22 con los
anidados): los doce identificadores aceptados (T-02), que cada vista monte un
único encabezado principal, que «la navegación no crea rutas ni enlaces: solo
botones» (`:175`), el alcance negativo del menú (T-03), el contrato de
intenciones (T-11) y que ninguna vista cree formularios, scripts ni recursos
remotos (T-12).

Sin la ampliación, `H-FID-B` habría fallado esa suite y su §11.6 obligaba a
detenerse. Con una ampliación amplia, una tarea puramente visual habría podido
relajar el contrato de navegación. La ampliación quirúrgica es el mecanismo que
permitió retirar una expectativa obsoleta —la campana no tenía fuente— sin abrir
la puerta a debilitar nada más. El diff real en el test confirma que se cumplió:
`git show fc9aa26 -- .../hospitalNavegacion.test.tsx` borra exactamente una
línea (`expect(envolvente).toContain('Novedades: 7 sin leer')`) y reescribe el
comentario.

## R4. Pacientes — composición recuperada y desviación de allowlist

```text
git show --stat c9a1195
```

Cuatro archivos: `HospitalPatientsPieces.tsx`, `hospitalPatients.module.css`,
`hospitalPatients.test.tsx` y **`hospitalPatientsConfig.ts`**.

La allowlist de `tasks/HOSPITAL-VISUAL-RECOVERY-01-A-PATIENTS.md` es:
`HospitalPatients.tsx`, `HospitalPatientsPieces.tsx`,
`hospitalPatients.module.css`, `hospitalPatients.test.tsx`. Es decir: el commit
tocó un archivo **no autorizado** y no tocó uno que sí lo estaba.

El cambio no autorizado es de una línea
(`git show c9a1195 -- .../hospitalPatientsConfig.ts`):

```text
-export const HOSPITAL_POBLACION_NO_DISPONIBLE = 'No disponible en CORE-01';
+export const HOSPITAL_POBLACION_NO_DISPONIBLE = 'Información no disponible';
```

Es coherente con la prohibición de copy técnico que las tareas hermanas exigen,
pero es una desviación de alcance. Ninguna auditoría la revisó (R13).

Estructura resultante en `HospitalPatientsPieces.tsx`: `SeccionFicha` (`:1127`),
`Campo` (`:1150`) con `data-no-disponible` y `aria-describedby` hacia
`AYUDA_PANEL_ID` (`:1124`), `resumenDeFicha` (`:1200`), `FichaHistorial`
(`:1218`) y `PoblacionPanel` (`:1262`). El bloque de historial no dibuja ningún
evento: dibuja `historialVacio` con el texto `Información no disponible`
asociado a la ayuda del diálogo (`:1229-1233`).

## R5. Profesionales — de tabla con métricas a directorio de tarjetas

```text
git show 4843612 -- apps/web/src/features/hospital/HospitalProfessionals.tsx
```

Se elimina el marcado `<table>/<thead>/<tbody>` con `<th scope="row">` y ocho
columnas. Se elimina del contrato de copy
(`hospitalProfessionalsConfig.ts`) la interfaz `HospitalProfesionalColumna`, el
array `columnas` con `pacientes`, `actividad`, `proxima` y `calificacion`, y las
claves `tituloResumen`, `etiquetaCalificacion`, `etiquetaProxima`,
`etiquetaPacientes` y `etiquetaHoy` del panel.

También cambia copy:
`HOSPITAL_PROFESIONALES_NO_DISPONIBLE` pasa de `'No disponible en este módulo'`
a `'Sin información registrada'`, y `accionVer` de `'Ver'` a `'Ver detalle'`.

La composición actual (`HospitalProfessionals.tsx:204-271`) es `<li>` con
`<h3>` de nombre, profesión, `HospitalBadge` de estado del perfil —con el
comentario explícito «el color acompaña, nunca sustituye a la palabra»— y una
`<dl>` de afiliación. La lista es `<ul aria-labelledby>` (`:633`).

## R6. Agenda — agrupación de acciones, variante de rechazo e icono de modalidad

```text
git show 3c738c9 -- apps/web/src/features/hospital/hospitalAgendaConfig.ts
```

Dos añadidos de contrato:

- `HospitalAgendaAccionDeshabilitada.variante: 'neutra' | 'rechazo'` (`:371-382`).
  Recupera el contorno rojo que la referencia reserva a `Rechazar con motivo`
  **sin habilitar nada**: en `HospitalAgenda.tsx:295-313` ambos botones siguen
  `disabled`, sin `onClick`, y cada uno lleva `aria-describedby` a un
  `merdn-sr-only` con su ayuda.
- `iconoDeModalidad` (`:714-731`), que reutiliza trazados ya existentes del
  módulo. Su comentario deja escrito el invariante: «siempre se lee además como
  texto al lado, de modo que ningún estado se comunica solo por icono ni solo
  por color».

En CSS, `.accionInactiva` (`hospitalAgenda.module.css:279-283`) documenta lo
mismo: «el atenuado ACOMPAÑA al atributo `disabled` y a la ayuda accesible».

El commit borra 373 líneas de CSS: la prueba `hospitalAgenda.test.tsx:886-901`
verifica que `.perspectiva`, `.estadosCard`, `.diaHoy`, `.diaFuera`, `.iniciales`
y otras reglas de bloques retirados ya no están en la hoja.

## R7. Reportes — la barra compacta y adherente, medida en la hoja

`hospitalReports.module.css:164-179`:

```text
.barra {
  --h-reportes-barra-top: 0px;
  position: sticky;
  top: var(--h-reportes-barra-top);
  z-index: 20;
  ...
  background: var(--b-blanco);
}
```

El comentario `:139-158` justifica el offset `0px`: la `.topbar` del shell
Hospital **no es fija ni adherente** (comprobado en `hospital.module.css:169`,
que no declara `position`), de modo que el borde superior efectivo es el del
viewport. La variable existe para poder cambiarlo en un solo punto si la topbar
pasara a ser fija.

Capas medidas: `.barra` 20, `.tabla thead th` 2, `.panelFondo` 40. La barra
queda sobre las cabeceras y bajo el modal.

Breakpoints medidos (`grep -n "@media" hospitalReports.module.css`): 768, 1024,
1280, 1400, `pointer: coarse` y `prefers-reduced-motion`. Alturas: base 44 px en
`.barraCampoControl`, `.chips`, `.chip`, `.accion`; 32 px desde 1024 px; 44 px
restituidos en `(pointer: coarse)` (`:975-983`). Hasta 767 px `.barraCampos`
usa `overflow-x: auto`; desde 768 px pasa a `grid-template-columns: repeat(3,
minmax(0, 1fr))` con `overflow-x: visible`; desde 1400 px a seis columnas.

`.tabs` recibe `margin-top: -6px` (`:409-414`) para subir contra la barra.

Cambio de marcado (`git show 82e6467 -- .../HospitalReportsPieces.tsx`): la
barra deja de usar las clases genéricas `filtro*` y estrena `barraCampo*`; el
motivo de exportación sale de `.acciones` y pasa a ser hermano en `.barraPie`.
Los seis `FiltroSelect`, sus `htmlFor`, sus opciones, los tres chips con
`aria-pressed` y los manejadores no cambian.

## R8. Reportes sigue sin datos reales

```text
grep -n "import" apps/web/src/features/hospital/HospitalReports.tsx | head
```

Importa `pacientesPoblacionDemo` y `POBLACION_FECHA_CORTE` de
`hospitalPopulationFixtures` (`:5`), `hospitalReportsSnapshot` (`:13`) y
`hospitalReportsOperationalFixtures` (`:36`). La barra de filtros es más baja y
se adhiere, pero filtra cifras demostrativas. `HOSPITAL-REPORTS-UX-01` no es una
tarea de recuperación tras conexión: es una corrección de densidad sobre una
vista nunca conectada.

## R9. Invariantes de accesibilidad presentes hoy, y los que faltan

Presentes, medidos:

- `aria-current="true"` en el item activo (`HospitalSidebar.tsx:145`), con prueba
  dedicada «el estado activo no se comunica solo con color»
  (`hospitalShell.test.tsx:274-282`).
- Menú neutral sin controles: `<li>` de texto, sin `type="button"`, sin
  controlador, precedido de un `merdn-sr-only` que declara el bloqueo
  (`HospitalSidebar.tsx:238-257`).
- `focus-visible` con `outline: 3px`: 9 declaraciones en `hospital.module.css`,
  6 en `hospitalPatients`, 4 en `hospitalProfessionals`, 9 en `hospitalReports`,
  1 en `hospitalAgenda` (`grep -c 'focus-visible'`).
- Toda acción visible e inoperante lleva `disabled` + `aria-describedby`
  (`HospitalAgenda.tsx:279`, `:305`, `:434`).
- Estados escritos como texto: badge de perfil en Profesionales
  (`HospitalProfessionals.tsx:233-236`), modalidad como texto junto al icono en
  Agenda, `Información no disponible` en Pacientes.
- Diálogo de ficha: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`,
  `Escape` con `stopPropagation` (`HospitalPatientsPieces.tsx:1288-1299`), foco
  al montar (`HospitalPatients.tsx:322-326`) y devolución al disparador
  (`:556-560`).

Ausentes, también medidos:

- **Sin trampa de foco**: `grep -n "inert\|trapFocus\|focus-trap"` en
  `HospitalPatients.tsx` no devuelve nada. Con `aria-modal="true"` declarado, el
  foco puede salir del diálogo con `Tab`.
- **`.sesionBoton` a 34 px** (`hospital.module.css:1099`) y sin
  `@media (pointer: coarse)`: `grep -rn "pointer: coarse" features/hospital/*.css`
  solo encuentra `hospitalReports.module.css`.
- **Contraste sin medir**: `.navItemBloqueado` usa `opacity: 0.72`
  (`hospital.module.css:152`). No hay prueba ni herramienta de contraste en el
  repositorio.
- **Sin auditoría automática**: `grep -rn "axe\|a11y"` sobre `apps/web/src` y
  `package.json` no devuelve nada.

## R10. El shell Hospital no usa el componente compartido de marca

```text
grep -rn "BrandLogo" apps/web/src
grep -rn "corazon-check" apps/web/src
```

`BrandLogo.tsx:9-11` se declara «fuente visual única del símbolo en todo el
frontend» y afirma que «ninguna incrusta la ruta del asset por su cuenta». Sus
únicos consumidores son `InscripcionExperience.tsx:6` y `:266`.
`HospitalSidebar.tsx:35` declara `const ELOISA_CORAZON_SRC =
'/brand/corazon-check.png'` y emite su propio `<img>`.

La causa está en la propia Task: `H-FID-B` §8 pone «componentes compartidos de
marca o assets publicos» fuera de alcance, y §7 cierra la allowlist a seis
archivos del módulo Hospital. La allowlist evitó un cambio de radio amplio y, al
hacerlo, duplicó el emisor del símbolo.

## R11. Configuración muerta que sobrevivió a la retirada del badge

```text
grep -n "readonly badge?\|readonly novedades\|HOSPITAL_NOVEDADES_DEMO" apps/web/src/features/hospital/hospitalConfig.ts
```

`:46` `readonly badge?: number`, `:58` `readonly novedades: number`, `:64`
`HOSPITAL_NOVEDADES_DEMO = 7`, `:88` el item «Novedades» con
`badge: HOSPITAL_NOVEDADES_DEMO`, `:123` `novedades: HOSPITAL_NOVEDADES_DEMO`.

Ningún componente lee `item.badge`: `HospitalNavItem`
(`HospitalSidebar.tsx:129-160`) solo dibuja icono y etiqueta, y
`HospitalSidebarNeutral` lo omite con un comentario explícito. La topbar ya no
recibe `novedades`. Es basura estructural, no un riesgo de datos, y sobrevive
porque `H-FID-B` §8 puso `hospitalConfig.ts` fuera de alcance.

## R12. `H-FID-C` se anunció y nunca se implementó

```text
ls tasks/ | grep H-FID          # → H-FID-A.md, H-FID-B.md
git log --oneline --all --grep="H-FID"
grep -rn "H-FID-C" --include="*.md" .
```

`H-FID-B` §1 se identifica como «Fidelity checkpoint 2 de 3». `H-FID-A` §6 y
`H-FID-B` §8 asignan a `H-FID-C` la «purga general de copy tecnico». Nueve Task
Specifications posteriores lo citan como fuera de alcance
(`HOSPITAL-VISITS-01-B`, `HOSPITAL-VISUAL-RECOVERY-01-A` y `-C`,
`VISITADOR-CORE-01-MP01`, `ELOISA-ADMIN-ACCESS-01-MP01`,
`HUMAN-PROFESSIONAL-SESSION-MINIMUM-UI`). No existe `tasks/H-FID-C.md`, no hay
commit con ese asunto y no hay implementación.

## R13. Copy técnico residual, consecuencia directa de R12

```text
grep -rnoE "'[^']*(backend|endpoint|API|fixture|prototipo)[^']*'" apps/web/src/features/hospital/*Config.ts
```

Dentro de las superficies recuperadas el copy está limpio: `grep "CORE-0"` sobre
`*.tsx` y `*Config.ts` solo devuelve descripciones de prueba, nunca texto
renderizado. Fuera de ellas persiste:

- `hospitalAdministrationConfig.ts:971` `'CSV · Excel · JSON · API'`, `:981`
  `'Ejemplo del prototipo'`, `:1388` `'Lo generará el backend en una tarea
  aprobada posterior; aquí los códigos son ejemplos.'`, `:1695`
  `'WhatsApp Business API'`.
- `hospitalVirtualConfig.ts:101` menciona `API`.
- `hospitalProfessionalsConfig.ts:56` `'No disponible en el prototipo'`, dentro
  de `HOSPITAL_SIN_FUENTE`, con comentario `:51-53` que explica por qué se
  conservó: lo consume `hospitalAdministrationConfig.ts`, fuera de alcance.

## R14. Ninguna auditoría cubre esta spec

```text
ls reviews/
git log --format="%h %ad %s" --date=short -- reviews/ | head
```

22 entradas: 20 veredictos de auditoría más `REVIEW-TEMPLATE.md` y `README.md`.
La más reciente entró en `efc4656` (2026-08-22). Las cinco tareas
de esta spec se implementaron el 2026-08-24. `reviews/README.md` declara el
directorio «Archivo histórico congelado (pre-SDD). Estado: solo lectura. Cerrado
el 2026-08-25» y prohíbe crear auditorías nuevas. No hay ni habrá veredicto de
Codex para `H-FID-B`, `HOSPITAL-VISUAL-RECOVERY-01-A/B/C` ni
`HOSPITAL-REPORTS-UX-01`.

Esto importa porque las tres tareas de recuperación exigían en su §«Evidencia de
entrega» un mapa «campo visible → propiedad DTO» y una confirmación de cero
fixtures. Ese handoff no está registrado en el repositorio.

## R15. Cómo se prueba realmente lo visual, y qué no demuestra

`apps/web/vitest.config.mts:28` fija `environment: 'node'`, y su comentario
`:13-14` lo explica: «Las pruebas renderizan los componentes de servidor con
`react-dom/server`, de modo que no se requiere jsdom ni una librería de testing
adicional». `grep -rn "jsdom\|@testing-library"` sobre los `package.json` del
monorepo no devuelve nada. `hospitalShell.test.tsx:34-39` lo confirma desde el
otro lado: «`renderToStaticMarkup` no ejecuta efectos y el repositorio no
incluye jsdom».

Consecuencia: los criterios visuales se verifican de dos formas, ambas
textuales.

1. **Cadena del HTML servido**: `expect(html).toContain('src="/brand/corazon-check.png"')`,
   `expect(html).not.toContain('_bellBadge_')`, conteo de `aria-current="true"`.
2. **Texto del propio archivo CSS**: `hospitalReportsVista.test.tsx:177-190`
   lee `hospitalReports.module.css` con `readFileSync` y parte la hoja por
   selector y por `@media` para afirmar `position: sticky`, `z-index: 20` o
   `min-height: 44px`. `hospitalAgenda.test.tsx:886-901` hace lo mismo para
   comprobar que las reglas retiradas ya no están.

Eso demuestra que la declaración existe en la hoja. **No** demuestra que la
barra se adhiera en un navegador, que la rejilla no desborde, que el foco entre
y vuelva, que `Escape` cierre, ni que ningún objetivo táctil quede corto.
`H-FID-B` §8 excluyó explícitamente «tests visuales golden, pixel diff o
redisenos generales», así que esa capa nunca se construyó.

Volumen de pruebas presente hoy (`grep -c "it("`): `hospitalShell` 71,
`hospitalAgenda` 67, `hospitalPatients` 63, `hospitalProfessionals` 57,
`hospitalReportsVista` 51, `hospitalNavegacion` 22.

## R16. Verificación no ejecutada

No se ejecutó **ninguna** prueba. `node_modules` no está instalado
(`ls -d node_modules` → ausente) y PostgreSQL no está levantado. Por tanto:

- No se ejecutaron `hospitalShell.test.tsx`, `hospitalNavegacion.test.tsx`,
  `hospitalPatients.test.tsx`, `hospitalProfessionals.test.tsx`,
  `hospitalAgenda.test.tsx` ni `hospitalReportsVista.test.tsx`. Que existan y
  que su código afirme lo que aquí se describe está verificado por lectura; que
  **pasen** hoy no está verificado.
- No se ejecutó `npm run typecheck --workspace @merdn/web` ni `eslint`.
- No se abrió ningún navegador. Adherencia de la barra, comportamiento
  responsive, orden de tabulación, trampa de foco, contraste real y objetivos
  táctiles efectivos **no se comprobaron**: solo se leyó la declaración CSS que
  los produciría.
- No se comparó ningún render contra `prototype-claude/Eligeme-Hospital.dc.html`.
  La afirmación «la composición es reconocible respecto de la referencia» es la
  afirmación de las Task Specifications, no una medición de esta investigación.
- Los handoffs que las tareas exigían (mapa campo→DTO, evidencia de las cuatro
  combinaciones `tipo/municipio`, resultados de pruebas) no están en el
  repositorio y no se pudieron consultar.
