# Idea general del proyecto — MERDN

> **Este archivo no es la fuente autoritativa del producto.** La definición de
> producto de MERDN vive en `docs/PRODUCT.md` y sus documentos asociados, y esa
> sigue siendo la única fuente válida. Lo que hay aquí es el resumen de entrada
> que SDD necesita para que una spec pueda referenciar su contexto sin
> reescribirlo.
>
> Si algo de este archivo contradice `docs/`, gana `docs/` y este archivo debe
> corregirse.

## Qué es

MERDN es una plataforma web para que instituciones públicas, prestadores de
salud, pacientes, cuidadores y profesionales coordinen, documenten, monitoreen y
evalúen la atención domiciliaria, los programas de población vulnerable, la
gestión institucional, el uso de recursos, la evidencia, el cumplimiento y los
resultados.

MERDN **no** es una aplicación de cuidados domiciliarios. La atención domiciliaria
es una capacidad operativa central dentro de un producto institucional más
amplio que también sirve a hospitales y alcaldías.

Hospital y Alcaldía son **experiencias diferenciadas sobre capacidades
compartidas**, no productos técnicos independientes.

Fuente: `docs/PRODUCT.md` §2, §3.

## Qué problema resuelve

La información operativa de los programas de atención a población vulnerable
está fragmentada entre actores y fuentes desconectadas. MERDN convierte esa
información en evidencia institucional trazable y auditable, capaz de responder
de forma verificable: quién recibe servicios, cuáles, quién los prestó, cuándo y
dónde, qué seguimiento requiere, qué recursos institucionales se usaron, qué
evidencia documental lo respalda y qué indicadores se generan.

Fuente: `docs/PRODUCT.md` §2, §4.

## Para quién

Paciente, Cuidador, Profesional, Hospital, Alcaldía, Administración y Auditoría.

Cada relación entre paciente, cuidador, profesional e institución conserva su
propia autorización, alcance, estado y vigencia.

Fuente: `docs/ROLES.md`, `docs/PRODUCT.md` §3.

## Fuera de alcance por ahora

MERDN **no** se presenta ni se implementa como:

- sustituto de Historia Clínica Electrónica;
- sistema contable gubernamental oficial;
- autoridad oficial de FURAG/MIPG, ADRES o evaluación ADRES;
- prueba automática de cumplimiento integral;
- procesador productivo de pagos sin aprobación separada.

La presencia estructural de un dominio **no** autoriza inventar datos, fórmulas,
reglas, fuentes oficiales, integraciones ni interpretaciones legales.

Fuente: `CLAUDE.md` §5, `docs/PRODUCT.md` §3.

## Alcance estratégico que ninguna spec puede reducir

`CLAUDE.md` §5 enumera 18 dominios cuya representación estructural y capacidad
de evolución deben preservarse en toda descomposición, modelo, interfaz, API,
almacenamiento, prueba y refactorización. Ninguna spec de este workspace puede
simplificar MERDN por debajo de ese alcance.

## Documentos autoritativos

| Documento | Gobierna |
|---|---|
| `AGENTS.md` | Sistema de agentes y reparto de autoridad |
| `CLAUDE.md` | Manual operativo de implementación, STOP CONDITIONS |
| `docs/PRODUCT.md` | Definición y decisiones de producto |
| `docs/ARCHITECTURE.md` | Arquitectura técnica de referencia y stack aprobado |
| `docs/MODULES.md` | Mapa funcional de módulos y secuencia de dependencias |
| `docs/ROLES.md` | Roles, permisos y experiencias |
| `docs/DATA.md` | Modelo de datos, procedencia y linaje |
| `docs/SECURITY.md` | Seguridad, privacidad y controles |
