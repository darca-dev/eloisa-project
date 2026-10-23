# 055 — Un único administrador de Hospital

Fecha: 2026-10-23. Autoridad: Product Owner, instrucción expresa «solo debe haber un admin de hospital».

Se ratifica la unicidad del administrador de Hospital. El modelo vigente la aplica mediante un único registro de experiencia `HOSPITAL` por tenant (`institutional_administrator_tenant_experience_unique`). Esta aclaración conserva esa restricción; no introduce un segundo administrador para cubrir escenarios de pruebas.

Para corregir B07, la preparación del navegador debe usar el único administrador y comprobar los estados con/sin concesión clínica mediante una secuencia válida o escenarios aislados que respeten la misma unicidad. No crear dos administradores Hospital en el mismo ámbito ni quitar o relajar la restricción. Ser administrador sigue sin otorgar permisos clínicos automáticamente; el revisor clínico y las cuentas ajenas mantienen sus pruebas separadas.

La corrección corresponde al fixture de pruebas y a su orden/preparación, dentro de MP07B. No requiere modificar esquema, migraciones, permisos ni el modelo institucional. Continúan pendientes navegador/axe y baseline; esta ratificación no constituye aceptación funcional ni autorización Git/despliegue.
