# Decisión — entorno funcional con datos de prueba y prioridad de SPEC 038
## Fecha

2026-09-28

## Decisión del Product Owner

El Product Owner indicó que MERDN debe entregarse como una aplicación funcional
local, con datos de prueba exclusivamente ficticios y persistentes; no como una
maqueta visual ni una demostración en memoria.

También autorizó diferir la investigación de infraestructura pendiente de
SPEC 025 / MP15. Esa decisión no descarta SPEC 025, no acepta su baseline como
verde y no autoriza producción, despliegue, `main` ni datos reales.

## Alcance operativo

1. La prioridad activa pasa a SPEC 038: persistencia, autenticación OIDC local,
   búsqueda, registros, revisión hospitalaria y portales reales sobre datos de
   prueba.
2. Toda persona, institución, credencial, relación, documento y dato visible
   seguirá siendo ficticio. El entorno se denominará «entorno de pruebas» en
   nuevas superficies y documentación operativa.
3. La carpeta y referencias históricas `038-demo-funcional-accesos-ficticios`
   se conservan por trazabilidad. No autorizan una interfaz simulada ni una
   fuente de verdad en React o `localStorage`.
4. SPEC 025 permanece pendiente: su fallo actual está en el inventario seguro de
   Docker antes de crear recursos. Debe retomarse antes de declarar una baseline
   de seguridad completa o una entrega de producción.
5. La fuente canónica para nuevos datos de prueba de 038 será `TEST_DATA` y el
   texto visible será «Datos ficticios de prueba». Se actualiza la referencia
   histórica `DEMONSTRATION` solo en los paquetes nuevos que la implementen.

## Justificación

Fuente: instrucción explícita del Product Owner en la sesión del 2026-09-28:
«sí pendiente y no es un demo debe ser real con datos de testeo».

La spec 038 ya aprobada define los controles necesarios: persistencia de servidor,
sesión OIDC local, aislamiento de tenant, auditoría y reset determinista. Esta
decisión prioriza su ejecución sin convertir el entorno de pruebas en producción.

## Consecuencias

- MP01-C1 de SPEC 038 puede iniciar la fundación persistente de solicitudes.
- Los campos de decisión y el catálogo de razones se implementarán con la bandeja
  hospitalaria, donde su comportamiento será verificable; no se inventan razones
  de rechazo en la fundación de datos.
- La evidencia de la aplicación debe diferenciar comportamiento implementado de
  validación de infraestructura pendiente.
