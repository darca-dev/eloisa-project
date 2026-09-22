# Plan 031 — Visitas domiciliarias demo local

## Enfoque

Crear un componente de presentación aislado para el montaje demo de Hospital.
Reutiliza tokens y piezas visuales existentes, pero no importa ni invoca el
cliente o la pantalla operacional de visitas.

## Fases

1. Definir cinco filas deterministas y sus conteos operativos de muestra.
2. Implementar la bandeja de solo lectura siguiendo la jerarquía de la vista
   `vVisitas` del prototipo protegido.
3. Seleccionar esa bandeja únicamente cuando `HospitalShell` recibe
   `modoDemoLocal`; conservar el montaje real en el resto de los casos.
4. Añadir pruebas de cinco filas, procedencia, ausencia de controles y
   aislamiento del flujo real; ejecutar gate, pruebas y build.

## Dependencias

- Aprobación y consentimiento SDD explícitos para la spec 031.
- Componentes y tokens visuales Hospital ya existentes.

## Rollback

Eliminar exclusivamente el montaje y módulos de demostración añadidos. No hay
API, base de datos ni estado persistente que migrar o revertir.
