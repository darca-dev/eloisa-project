# Investigación 031 — Visitas domiciliarias demo local

## Hechos verificados

1. `HospitalHomeVisits` está conectado a una visita materializada desde Agenda
   y a una sesión humana profesional; sin visita abierta muestra explícitamente
   un estado vacío.
2. `hospitalVisitsClient.ts` limita las rutas reales a consultar y cambiar el
   estado de una visita; no ofrece un listado seguro de visitas.
3. El prototipo protegido contiene una composición visual de bandeja para
   `vVisitas`, incluida una lista de cinco filas, pero no es código de
   producción ni fuente de datos institucionales.
4. La spec 030 autoriza demo local solo para Agenda, Pacientes y Profesionales,
   y prohíbe materializar visitas; no habilita modificar Visitas domiciliarias.

## Decisión de diseño

Se crea una superficie separada de solo lectura y se monta exclusivamente
cuando `modoDemoLocal` está activo. No se amplía ni simula el cliente real de
visitas, no se falsifica una sesión profesional y no se usa la bandeja demo
para ejecutar transiciones.

## Alternativas descartadas

- Inyectar datos ficticios en `HospitalHomeVisits`: mezclaría la demo con la
  operación real y podría sugerir que una sesión profesional fue autorizada.
- Cambiar el cliente de visitas para listar muestras: introduciría una frontera
  HTTP simulada donde la spec exige cero red.
- Reutilizar los fixtures históricos de `hospitalVisitsConfig`: están usados
  por otras superficies y su modificación podría generar efectos colaterales;
  la demo necesita su propia procedencia local explícita.
