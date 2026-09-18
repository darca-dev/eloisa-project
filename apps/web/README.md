# @merdn/web — Frontend MERDN (Next.js App Router)

Fundación técnica del frontend de MERDN (TASK-001), primera experiencia visual
aprobada (TASK-002) y correcciones aprobadas por el Product Owner (TASK-002A).

La guía completa de operación del monorepo (instalación, lint, typecheck, test,
build, Docker Compose, verificación de PostgreSQL y parada limpia) está en
[`apps/api/README.md`](../api/README.md).

---

## 1. Alcance implementado

La ruta raíz `/` abre la **pantalla oficial de inscripción**,
«¿Cómo se va a registrar?», con las tres opciones aprobadas —**Paciente**,
**Cuidador** y **Visitador médico**—, reconstruida a partir de
`prototype-claude/Eligeme-Inscripcion.dc.html` con los tokens de
`prototype-claude/Eligeme-Linea-Visual-B.dc.html`.

Tras elegir el perfil se renderiza **solo** esa rama, de cinco pasos, y el rol no
se vuelve a preguntar. Después de la confirmación local de la rama Paciente se
puede abrir el **Inicio del Paciente** y, desde allí, la **bitácora completa de
ocho etapas**, que no forma parte de la inscripción.

El recorrido First Run 1a de TASK-002 deja de ser el flujo principal: sus
primitivas visuales se reutilizan, pero sus 16 pantallas ya no son obligatorias
y no se conservan como recorrido activo.

`prototype-claude/` permanece protegido y de solo lectura: ningún `.dc.html`,
`support.js` ni el runtime de Claude Design se importa o ejecuta en el build.

La experiencia es **demostrativa**:

- todo el estado es efímero y vive en memoria del navegador;
- no hay API, Server Actions, cookies, `localStorage` ni `sessionStorage`;
- no hay autenticación, cuentas, verificación, búsqueda o vínculo de pacientes,
  ubicación, historia clínica, alertamiento, pagos ni funcionamiento offline;
- los datos de ejemplo son ficticios;
- los controles que el diseño muestra pero que no ejecutan nada (usar mi
  ubicación, buscar paciente, cargar documentos, tarjetas del inicio, menú,
  novedades) se marcan `aria-disabled` y comparten un texto accesible que lo
  declara.

Fuera de alcance en TASK-002A: backend, API, persistencia, autenticación,
autorización, tenancy, reglas clínicas, chatbot o voz e integraciones.

> La capacidad general **offline con sincronización posterior** queda registrada
> como trabajo inmediato posterior y **no** está implementada. Ninguna pantalla
> la anuncia. Que el catálogo territorial funcione sin red no equivale a
> almacenamiento offline ni a sincronización de formularios.

---

## 1.1 Catálogo territorial DANE DIVIPOLA

Todo grupo de ubicación de las tres ramas usa, en este orden exacto,
**Departamento**, **Municipio** (dependiente del departamento) y **Nombre del
corregimiento** (texto libre).

Las opciones proceden de un catálogo local y versionado en
[`src/data/divipola.ts`](src/data/divipola.ts), derivado de la División
Político-Administrativa de Colombia (DIVIPOLA) del **DANE**, publicada en el
portal de datos abiertos del Estado colombiano:

| Elemento | Conjunto | Corte de datos | Registros |
| --- | --- | --- | --- |
| Departamentos | `DIVIPOLA- Códigos departamentos` (`vcjz-niiq`, DANE) | 2025-01-23 | 33 |
| Municipios | `DIVIPOLA - Códigos cabeceras - Centros poblados` (`xaxy-8nri`, DANE) | 2025-01-24 | 1.122 |

Fecha de obtención por MERDN: **2026-08-20**. Los municipios se contrastaron uno
a uno con el conjunto `DIVIPOLA- Códigos municipios` (`gdxc-w37w`): ambos
coinciden exactamente. Los metadatos viven en `DIVIPOLA_METADATA`, dentro del
mismo archivo.

El archivo es **generado** y no se edita a mano. Se consulta de forma síncrona en
el bundle: la aplicación **no** llama a DANE en tiempo de ejecución y los
selectores funcionan sin red. Actualizarlo es reemplazar ese archivo y su
metadato de versión, sin tocar los componentes de formulario.

---

## 1.2 Obligatoriedad de los datos

En **Paciente** y **Cuidador** todos los datos solicitados son obligatorios: no
queda ningún campo rotulado como opcional. Un campo condicional es obligatorio
mientras está visible; al desactivarse su condición se oculta, su error
desaparece y su valor se borra del estado local.

La rama **Visitador médico** conserva la obligatoriedad de su flujo aprobado. Lo
único que se añadió allí es lo que la decisión de ubicación exige en las tres
ramas: Departamento y Municipio de cada grupo.

Los labels obligatorios llevan `*` acompañado del texto accesible
«campo obligatorio», y cada formulario abre con la leyenda visible «Los campos
marcados con asterisco son obligatorios.».

---

## 2. Configuración de entorno

La experiencia visual **no** lee variables de entorno. Las variables siguientes
pertenecen a la fundación técnica y siguen validándose donde se usan.

| Variable | Obligatoria | Valor por defecto | Uso |
| --- | --- | --- | --- |
| `MERDN_API_BASE_URL` | Sí, para módulos que consuman la API | — | URL base de la API. `/` no la usa ni la muestra. |
| `MERDN_ENVIRONMENT` | No | `development` | `development` \| `test` \| `mvp` |
| `PORT` | No | `3000` | Puerto de escucha en modo `start` |
| `NEXT_TELEMETRY_DISABLED` | No | — | `1` desactiva la telemetría anónima de Next.js |

No hay secretos en el frontend.

---

## 3. Ejecución local y recorrido de revisión

Desde la raíz del repositorio:

```bash
npm run dev:web            # http://localhost:3000
```

Recorrido determinista para comparar con el prototipo:

1. `/` abre «¿Cómo se va a registrar?». Comparar a **680 × 900** CSS px.
2. Cada tarjeta abre exclusivamente su rama, con progreso «Paso X de 5» y un
   carril de cinco pasos para saltar dentro de la misma rama.
3. **Atrás** en el paso 1 y **Cambiar de rol** vuelven a la selección inicial y
   descartan lo diligenciado en la rama anterior.
4. En Paciente, el paso 2 reúne la clasificación prioritaria —las tres casillas
   son independientes— y Diagnósticos, incluida la opción **Otros** con uno o
   más textos libres y **Ninguna** como opción excluyente.
5. El paso 5 revisa la información y termina en el cierre local. En la rama
   Paciente ese cierre ofrece abrir el Inicio del Paciente.
6. En Inicio, **Mi bitácora** abre las ocho etapas, con progreso propio
   «Paso X de 8», anterior/siguiente, conservación de valores y revisión final.
   Comparar Inicio, iconos y la burbuja de la IA a **390 × 844** CSS px.
7. Recargar la página devuelve todo a su estado inicial.

8. En cualquier grupo de ubicación: **Municipio** aparece deshabilitado hasta
   elegir **Departamento**; al cambiar de departamento se descarta el municipio
   que ya no le pertenece. Puede comprobarse con la red desconectada.

Validación local: intentar continuar con cualquier dato faltante de Paciente o
Cuidador muestra el error asociado al control o al grupo, lo anuncia de forma
accesible y mueve el foco al primer inválido. Lo mismo ocurre con los campos
condicionales visibles (RLCPD, cuidador y apoyos, formación del cuidador, cada
fila de «Otros» en Diagnósticos) y con la autorización del paso 5.

---

## 4. Pruebas

```bash
npm run lint                              # raíz
npm run typecheck                         # raíz
npm run test --workspace @merdn/web
npm run build:web                         # raíz
```

Las pruebas renderizan con `react-dom/server` y ejercitan los reductores puros,
por lo que no requieren jsdom ni navegador. Cubren la entrada oficial, la
selección de perfil, el aislamiento entre ramas, los cinco pasos por rama, la
ausencia de una segunda pregunta de rol, la clasificación prioritaria simultánea
e independiente, Diagnósticos dentro del paso 2 con «Otros» y «Ninguna», la
ausencia de la bitácora dentro de la inscripción, las ocho etapas posteriores,
los iconos semánticos del Inicio, la ausencia de la IA en la cuadrícula, la
burbuja flotante y sus atributos, y la sustitución de los nombres de marca.

Las pruebas visuales, responsive, de accesibilidad automatizada y de
consola/red requieren navegador y no se ejecutan desde esta suite.

---

## 5. Estructura y decisiones técnicas

```text
apps/web/
  public/brand/           logo aprobado corazón-check (recorte trazable)
  public/eli/             expresiones aprobadas de la IA usadas por la aplicación
  src/
    data/divipola.ts      catálogo local DANE DIVIPOLA (generado, versionado)
    app/
      layout.tsx          documento raíz (`lang="es"`, Nunito autoalojada)
      page.tsx            Server Component; compone la entrada de inscripción
      globals.css         base transversal + import de los tokens
    components/ui/        primitivas compartidas (botones, campos, elección,
                          progreso, marco móvil, iconos semánticos, Elí)
    config/
      branding.ts         nombres visibles provisionales (fuente única)
      environment.ts      configuración tipada de la fundación técnica
    features/
      experiencia/        raíz de la demostración: inscripción → paciente
      inscripcion/        flujo oficial: reductor puro + tres ramas de 5 pasos
      paciente/           Inicio del Paciente y bitácora completa de 8 etapas
    styles/tokens.css     tokens de Línea Visual B
```

- **Fronteras server/client:** `layout.tsx` y `page.tsx` son Server Components;
  las fronteras cliente son `features/experiencia/ExperienciaMerdn.tsx`,
  `features/inscripcion/InscripcionExperience.tsx`,
  `features/paciente/PacienteExperience.tsx` y `components/ui/EliBubble.tsx`.
- **Tipografía:** Nunito mediante `next/font/google`, autoalojada en el build,
  con fallback `system-ui, sans-serif`. No se solicitan fuentes a terceros en
  tiempo de ejecución.
- **Estilos:** CSS Modules sobre variables CSS. Ningún componente define color
  propio: todos consumen los tokens de Línea Visual B.
- **Iconos:** SVG code-native en `components/ui/Icon.tsx`, con trazo uniforme y
  `currentColor`. Sustituyen los cuadrados de color del Inicio sin añadir
  dependencias ni assets.
- **Branding:** `platformDisplayName`, `platformTagline`, `inscriptionSubtitle` y
  `aiDisplayName` viven solo en `src/config/branding.ts`; una prueba demuestra
  que sustituirlos cambia las apariciones de marca sin tocar componentes ni
  estructura. `inscriptionSubtitle` («Evidencia · Local · Inteligente») aplica
  **solo** al encabezado de inscripción; los demás encabezados conservan la
  bajada aprobada del prototipo.
- **Sin dependencias nuevas:** no se añadieron UI kits, librerías de formularios,
  state managers ni iconografía externa.

### Identidad visual y expresiones de la IA

- **Logo corazón-check.** `components/ui/BrandLogo.tsx` es la única fuente del
  símbolo aprobado. Su asset, `public/brand/corazon-check.png`, es un recorte
  fiel del lockup de marca de la lámina de identidad aprobada del prototipo,
  `prototype-claude/ref/personaje2.png` (región 259,15 de 82 × 84 px sobre el
  original de 1536 × 1024, exportada a 164 × 168 px). Se conservaron forma,
  proporciones y colores; solo se llevó a transparente el fondo casi blanco de
  la lámina. El símbolo no se redibujó y el archivo fuente no se modificó.
- **Mapeo de expresiones.** `components/ui/eliExpressions.ts` relaciona una
  INTENCIÓN semántica con un asset aprobado y su referencia de lámina. Ningún
  componente escribe rutas de imagen ni elige pose por su cuenta.
- **Poses en uso.** `escucha` (TE ESCUCHA) en la primera aparición del
  encabezado de inscripción; `pregunta` (gesto PREGUNTA) en el activador
  flotante; `guia` (TE GUÍA PASO A PASO) en el encabezado del panel y en la
  bitácora; `agradece` (TE AGRADECE) en el cierre. Ninguna intención comparte
  asset con otra y una prueba lo verifica.
- **Procedencia de `pregunta`.** No existía como archivo independiente en el
  prototipo. Se obtuvo un recorte fiel de la tarjeta «PREGUNTA» de la fila
  «ELÍ USA GESTOS Y EXPRESIONES PARA QUE TODO SEA MÁS FÁCIL» de
  `prototype-claude/ref/personaje2.png` (región 175,764 de 95 × 106 px),
  reencuadrado a 108 × 121 px para igualar el encuadre de los assets ya
  existentes en `prototype-claude/assets/eli/`. Los demás assets de
  `public/eli/` son copias exactas de esos archivos.
- **Tono.** La IA habla siempre de tú y su presentación es un texto fijo
  aprobado. No aparece en ninguna superficie la etiqueta «Asistente virtual».

### Accesibilidad

`main` único, `h1` por pantalla con foco al cambiar de paso, labels visibles
asociados a cada campo, `fieldset`/`legend` en los grupos de opciones, errores
con `role="alert"` + `aria-describedby` + `aria-invalid` y marca textual además
del color, foco movido al primer error, progreso expuesto como `progressbar` con
texto «Paso X de 5» y «Paso X de 8», objetivos táctiles de al menos 44 × 44 px,
imágenes decorativas ocultas, `prefers-reduced-motion` respetado y burbuja de la
IA con `aria-expanded`, `aria-controls` y cierre con `Escape` que devuelve el
foco al activador.
