# Inspección 047

HubAccessPortal usa Link /hospital y /municipality. Los gates interiores muestran InstitutionalAccess sin sesión y allí hay otro enlace al helper OIDC. El mismo hub ya ofrece InstitutionalRegistrationLink independiente, condicionado por API.

La allowlist de retorno backend solo admite / y /acceso; el selector /acceso deriva las experiencias del servidor. Se reutiliza ese circuito sin ampliarlo. Cambiar solamente los enlaces evita el segundo clic y mantiene logout y rutas protegidas intactos.
