# Tareas 005 - Experiencia visual Alcaldía

> As-built: `[x]` = verificado presente el 2026-08-25. `[ ]` = límite conocido.

## Implementado

- [x] Shell municipal con barra lateral y superior
- [x] Inicio, población, territorio, programas, cuidadores, atención
- [x] Presupuesto y detalle financiero
- [x] Indicadores, brechas, evidencias
- [x] Vistas FURAG y ADRES sin atribución de carácter oficial
- [x] Reportes y marcador de próximamente
- [x] Configurable por municipio, sin piloto codificado
- [x] 10 archivos de prueba, incluida una específica de privacidad

## Estado de conexión (hecho / no hecho)

- [x] Población conectada a la API — spec 008
- [x] Territorio conectado a la API — spec 008
- [ ] Presupuesto, ejecución, proveedores, contratos — sin modelo en Prisma
- [ ] Indicadores, brechas, evidencias documentales — sin modelo en Prisma
- [ ] FURAG, MIPG, ADRES — sin modelo en Prisma y sin fuente oficial aprobada

## Límites conocidos (no autorizados como trabajo)

- [ ] Separar estructura de dato de demostración en `municipalityConfig.ts` (5.059 líneas)
- [ ] Marca visual que distinga vista conectada de vista de configuración

## Verificación pendiente

- [ ] Ejecutar la suite de `features/municipality`
