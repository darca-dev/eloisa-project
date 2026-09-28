# Especificación 031 — Visitas domiciliarias demo local

## Estado de aprobación

- Estado / Status: `Aprobado`
- Fecha de aprobación: `2026-09-21`
- Aprobado por: `Product Owner`
- Evidencia de aprobación: la Product Owner aprobó explícitamente el
  consentimiento SDD para implementar cinco muestras ficticias de solo lectura
  en Visitas domiciliarias demo local. La aprobación previa de la spec 030 no
  se usa para extender este alcance.

## Objetivo y valor

Permitir demostrar la sección **Visitas domiciliarias** de `/hospital` con una
composición visual equivalente a la referencia y exactamente cinco registros
totalmente ficticios, sin mezclar la demostración con la operación real de una
visita domiciliaria.

## Usuarios, alcance y separación

- Afecta únicamente la sesión de demostración local de Hospital en `/hospital`.
- El modo normal conserva `HospitalHomeVisits` y su flujo real de visita
  materializada, sesión humana y autorización del servidor sin cambios.
- La fuente es `DEMO_LOCAL_FICTICIA`; no representa un hospital, paciente,
  profesional, municipio ni atención real.
- No hay datos clínicos, diagnósticos, semáforos clínicos, direcciones, rutas,
  ubicación, contacto ni evidencia. Los estados son solo operativos de muestra.

## Requisitos funcionales

1. Cuando la sesión demo local abra `Visitas domiciliarias`, el sistema debe
   mostrar una bandeja visual con encabezado, conteos operativos, filtros
   informativos y exactamente cinco filas ficticias.
2. Cada fila debe contener solo fecha/hora de muestra, nombre ficticio,
   zona ficticia general, profesional ficticio y estado operativo legible.
3. Debe existir un aviso visible y accesible: «Datos ficticios de demostración
   local. No se guardan cambios.»
4. La bandeja demo debe ser de solo lectura: no puede iniciar, completar,
   cancelar, asignar, materializar ni guardar visitas.
5. En modo no demo debe seguir montándose la vista operativa existente y no
   deben cambiar sus llamadas, permisos, sesión humana ni transiciones.

## Seguridad, privacidad, auditoría y procedencia

- Las cinco muestras son deterministas y ficticias; no se guardan en navegador,
  red, cookies, base de datos, logs, archivos ni terceros.
- La vista demo no hace llamadas de red ni invoca clientes de visitas,
  autenticación, sesión humana o API institucional.
- Al no existir operación ni dato real, no se crean eventos de auditoría de
  negocio. La procedencia local ficticia se declara visualmente.
- La demo no sustituye la autorización de servidor ni pretende acreditar una
  atención domiciliaria, cumplimiento o dato clínico.

## Accesibilidad

- El encabezado, los conteos y la lista deben usar HTML semántico y mantener
  texto de estado además del color.
- No habrá botones engañosos ni controles inertes. La marca de procedencia debe
  ser legible sin depender del color.

## Archivos permitidos

- `apps/web/src/features/hospital/HospitalShell.tsx`
- `apps/web/src/features/hospital/HospitalHomeVisitsDemo.tsx`
- `apps/web/src/features/hospital/hospitalVisitsDemoLocal.ts`
- `apps/web/src/features/hospital/hospitalHomeVisitsDemo.test.tsx`
- `apps/web/src/features/hospital/hospitalViews.module.css`
- `spec/specs/031-hospital-visits-demo-local/**`
- `spec/specs/INDEX.md`
- `spec/.sdd/user-consent.log`

## Prohibido

- `prototype-claude/`, `apps/api/`, PostgreSQL, Prisma, migraciones, Docker,
  API HTTP, autenticación, cookies, OIDC, RLS, roles, permisos y auditoría de
  negocio.
- Cambiar `HospitalHomeVisits.tsx`, `hospitalVisitsClient.ts`,
  `hospitalHumanSessionClient.ts` o el comportamiento operativo real.
- Crear, editar, asignar, iniciar, completar, cancelar o materializar visitas.
- Datos reales, datos clínicos, integraciones institucionales, entidades
  externas, rutas, geolocalización, direcciones, contactos o evidencia.
- `develop`, `main`, commits, merges, despliegues o pushes sin autorización
  independiente de Git.

## Criterios de aceptación

- En `/hospital` demo, Visitas domiciliarias presenta la jerarquía visual del
  canvas y cinco filas de muestra con procedencia ficticia explícita.
- La superficie demo no realiza `fetch` ni expone acciones persistentes.
- La vista real de visitas se conserva para cualquier montaje no demo.
- Pruebas focalizadas, comprobación SDD y compilación de `@merdn/web` pasan.

## Riesgos, reversión y decisiones abiertas

- Riesgo: confundir demostración con operación real. Mitigación: separación de
  componente, texto de procedencia y ausencia de controles de escritura.
- Reversión: retirar el montaje y los dos módulos demo; no hay datos ni cambios
  persistentes que revertir.
- No hay decisiones clínicas, institucionales o de integración pendientes: el
  alcance se limita a presentación ficticia local de solo lectura.
