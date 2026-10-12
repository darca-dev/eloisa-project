# Investigación 040 — 2026-10-12

- `HubAccessPortal.tsx`: Atención Domiciliaria tiene ingreso y registro; Hospital
  y Alcaldía solo enlazan sus shells.
- `AccessRegistrationWizard.tsx`: el registro actual admite PATIENT, CAREGIVER y
  FIELD_PROFESSIONAL y espera aprobación Hospital. No cubre administradores.
- `InstitutionalAuthController`: abre/consulta/revoca sesiones; declara ausencia
  de registro público y emplea credenciales institucionales de configuración.
- `InstitutionalAuthService`: aprovisiona identidades de configuración en primera
  autenticación y consulta únicamente su mapa. No reutilizar esta función como
  si ya admitiera las cuentas nuevas.
- `InstitutionalIdentity`: identidad opaca, enum de capacidades legadas disjuntas,
  hash/sal de credencial y unicidad tenant/code. No tiene reserva de primer admin.
- `docs/plan-funcional/01-ACCESOS-REALES.md`: dirección propuesta de cuenta nominal
  institucional y OIDC. `docs/SECURITY.md` exige evitar nueva autenticación propia.
- Spec 035 prohibía autorregistro institucional. La nueva decisión de la Product
  Owner sustituye esa prohibición para el primer administrador exclusivamente.
- La instalación Docker activa conserva servicios previos; no se inspeccionaron
  secretos ni se migró/reinició la base en esta tarea.

## Verificación documental inicial

Antes de estos documentos, `check-sdd-gate.sh .` y `validate-sdd.sh . --strict`
terminaron con exit 0. El gate corresponde a specs anteriores; no autoriza 040.
Se repiten después de añadir los documentos para validar estructura, no implementación.
