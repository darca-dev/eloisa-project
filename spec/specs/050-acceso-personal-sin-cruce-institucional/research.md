# Investigación 050

El hub personal enlaza /acceso antes de autenticar. CentralAccess consulta experiencias y redirige si recibe una sola, incluida MUNICIPALITY. El helper común ya retorna /acceso, pero API049 solo solicita credenciales interactivas para Hospital/Alcaldía. Ambos puntos explican el cruce comunicado sin implicar nuevos permisos.

La revisión independiente detecta el único consumidor vigente de POST reauthenticate: AccessPasswordRecovery en Hospital. Su retorno anterior /acceso dejaría de reconocer HOSPITAL al restringir el selector personal. Se corrige a /hospital, ruta ya allowlisted, sin cambiar semántica de autenticación reforzada ni aceptar destinos del navegador.
