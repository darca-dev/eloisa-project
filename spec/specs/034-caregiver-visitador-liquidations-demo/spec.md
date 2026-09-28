# Especificación 034 — Liquidaciones demo de Cuidador y Visitador

## Estado de aprobación / Approval status

- Estado / Status: `Aprobado`
- Fecha de aprobación / Approval date: `2026-09-22`.
- Aprobado por / Approved by: Product Owner.
- Evidencia de aprobación / Approval evidence: el 2026-09-22 la Product Owner
  eligió crear un portal demo propio de Cuidador y solicitó que la vista también
  aplique al Visitador médico. El mismo día aprobó explícitamente el
  consentimiento SDD para implementar este alcance de solo lectura.

## Objetivo y valor

Demostrar para Cuidador y Visitador médico una misma capacidad de consulta de
**Mis pagos y liquidaciones**: servicios de muestra, valor de referencia,
estado administrativo y resumen del corte. El objetivo es explicar cómo se
vería una futura liquidación, sin custodiar dinero ni afirmar que hay pagos
reales.

## Alcance

- Crear la ruta demo `/cuidador` con una presentación específica de Cuidador.
- Añadir una pestaña funcional de navegación local «Mis pagos y liquidaciones»
  al portal existente `/profesional` para Visitador médico. La pantalla debe
  alternar entre la hoja de ruta actual y la liquidación local.
- Reutilizar un modelo visual compartido, con identidad de rol y registros
  ficticios deterministas diferentes por persona demostrativa.
- Mostrar únicamente: resumen del corte, servicios/actividades ficticias,
  estado administrativo en texto y leyenda de procedencia local.
- Los estados permitidos son de seguimiento administrativo: `En revisión`,
  `Aprobado para corte` y `Pagado de muestra`. No son una orden de pago, un
  comprobante, una conciliación ni garantía de pago.

## Fuera de alcance

- Saldo custodiado, monedero, tarjetas, transferencias, cobros, retiros,
  cuentas bancarias, datos de instrumentos de pago, procesadores, conciliación,
  impuestos, facturas, nómina, contratos, comisiones, exportación o soporte
  documental.
- APIs, base de datos, autenticación, autorización, cookies, sesiones,
  auditoría de negocio, Docker e integraciones institucionales o externas.
- Cambiar las visitas, bitácora, reglas clínicas, datos de pacientes o el
  contenido institucional existente en el portal profesional.
- Modificar `prototype-claude/`, `develop` o `main`.

## Usuarios, permisos y datos

- Usuarios demostrativos: un Cuidador y un Visitador médico ficticios. La ruta
  no representa identidad autenticada ni concede acceso a información real.
- Datos: constantes locales con nombres genéricos, actividades no clínicas y
  montos de referencia; sin pacientes, direcciones, identificaciones,
  instituciones externas ni detalles bancarios.
- Propiedad/procedencia: datos ficticios de demostración local. Debe declararse
  visualmente que no se guardan cambios y que no hay dinero disponible.
- La implementación no amplía permisos. Una futura versión real requerirá
  identidad autenticada, alcance por tenant e institución, separación de
  funciones, validación de prestación, auditoría de acceso y controles
  financieros separados.
- No se registran eventos de auditoría, pues la superficie no crea, modifica,
  aprueba ni paga nada.

## Seguridad y privacidad

- Cero llamadas de red, persistencia, almacenamiento local, mutaciones, datos
  personales reales o información financiera sensible.
- Los datos de liquidación no se vinculan con contenido clínico ni con la
  identidad o domicilio de un paciente.
- Las etiquetas y estados no usan solo color; su significado se expresa con
  texto accesible.

## Accesibilidad

- Navegación entre pestañas mediante botones reales y estado activo anunciado.
- Encabezados semánticos, tabla con `caption`, encabezados de columna y foco
  visible.
- El diseño debe responder en móvil sin ocultar ni truncar el estado o monto de
  referencia.

## Archivos permitidos

- `apps/web/src/app/cuidador/page.tsx`
- `apps/web/src/features/caregiver/CaregiverLiquidationsDemo.tsx`
- `apps/web/src/features/caregiver/caregiverLiquidationsDemo.module.css`
- `apps/web/src/features/liquidations/LiquidationsDemo.tsx`
- `apps/web/src/features/liquidations/liquidationsDemoData.ts`
- `apps/web/src/features/liquidations/liquidationsDemo.module.css`
- `apps/web/src/features/liquidations/liquidationsDemo.test.tsx`
- `apps/web/src/features/profesional/ProfesionalPortal.tsx`
- `apps/web/src/features/profesional/profesional.module.css`
- `spec/specs/034-caregiver-visitador-liquidations-demo/**`
- `spec/specs/INDEX.md`
- `spec/.sdd/user-consent.log`

## Criterios de aceptación

1. CUANDO se abre `/cuidador`, EL SISTEMA DEBERÁ mostrar una experiencia demo
   de Cuidador y una sección «Mis pagos y liquidaciones» con datos locales
   explícitamente ficticios.
2. CUANDO un Visitador abre «Mis pagos y liquidaciones» en `/profesional`, EL
   SISTEMA DEBERÁ mostrar el mismo modelo de consulta local y poder regresar a
   la hoja de ruta existente.
3. LA DEMOSTRACIÓN NO DEBERÁ consultar red, persistir, exponer datos bancarios,
   custodiar saldo, iniciar pagos ni mostrar afirmaciones de pago real.
4. LAS dos experiencias DEBERÁN diferenciar el rol solo por contenido de
   demostración, reutilizando el componente y tipos compartidos.
5. Pruebas focalizadas, validación SDD, compuerta y build web DEBERÁN finalizar
   correctamente.
