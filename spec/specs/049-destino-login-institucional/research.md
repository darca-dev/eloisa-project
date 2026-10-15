# Inspección 049

047 usa el mismo helper /human-auth/login?returnTo=/acceso para ambas instituciones. /acceso consulta experiencias y redirige a la única aprobada: MUNICIPALITY en la cuenta actual. Keycloak conserva SSO. El PO confirma retorno a Alcaldía, no acceso indebido a Hospital.

HumanAuthAttempt ya almacena returnTarget vinculado a state/nonce/PKCE con consumo atómico. API y CHECK limitan actualmente / y /acceso. Añadir únicamente /hospital y /municipality conserva arquitectura y permite gates independientes tras callback. Adapter ya soporta petición prompt=login/max_age=0; el vínculo step-up se gestiona aparte en servicio y no se utiliza para este login normal.
