# Investigación 037

Los registros de `oidc-local` muestran que Keycloak 26 falla al deserializar
`requiredActions` de `realm-merdn-patient.json`: recibe el texto
`UPDATE_PASSWORD` donde espera una representación de acción. Las acciones
integradas de Keycloak no deben redeclararse para este realm local.
