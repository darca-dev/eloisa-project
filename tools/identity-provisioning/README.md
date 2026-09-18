# Aprovisionamiento de identidad humana (comando administrativo)

IDENTITY-RELATIONSHIPS-CORE-01 §9. Es el **único** camino por el que un
`subject` verificado por el proveedor OIDC queda asociado a una `Person` de
MERDN.

**No existe endpoint de vinculación**, ni público ni privado. Tampoco existe
emparejamiento por correo, documento, nombre ni ningún otro claim: cambiar el
correo en el proveedor no cambia —ni puede cambiar— a quién representa una
sesión en MERDN.

## Uso

```bash
# Ensayo. NO escribe nada.
npm run identity:provision -- --file /ruta/absoluta/operaciones.json --dry-run

# Aplicación real.
npm run identity:provision -- --file /ruta/absoluta/operaciones.json --apply
```

`--dry-run` es el comportamiento **por defecto**: sin `--apply` el comando
nunca escribe. El ensayo ejecuta exactamente el mismo trabajo dentro de la
transacción y termina con `ROLLBACK`, de modo que también comprueba claves
foráneas compuestas, restricciones `CHECK` y políticas de Row Level Security.

La ruta debe ser **absoluta**: aprovisionar identidades con el archivo
equivocado no es un error recuperable.

## Archivo de operaciones

No se versiona. Es un objeto, o un arreglo de objetos, con esquema
**discriminado y estricto**. Cualquier campo no declarado invalida el archivo
completo y no se aplica nada.

```json
[
  {
    "action": "LINK",
    "tenantCode": "merdn-mvp",
    "personId": "00000000-0000-0000-0000-000000000000",
    "issuer": "http://host.docker.internal:8081/realms/merdn-local",
    "subject": "00000000-0000-4000-8000-00000000f1c7"
  },
  {
    "action": "UNLINK",
    "tenantCode": "merdn-mvp",
    "issuer": "http://host.docker.internal:8081/realms/merdn-local",
    "subject": "00000000-0000-4000-8000-00000000f1c7"
  },
  {
    "action": "DISABLE_ACCOUNT",
    "tenantCode": "merdn-mvp",
    "humanAccountId": "00000000-0000-0000-0000-000000000000"
  }
]
```

## Comportamiento

| Situación | Desenlace |
| --- | --- |
| `LINK` sin vínculo previo | crea **una** `HumanAccount` y su vínculo en la misma transacción |
| `LINK` con vínculo activo de la misma persona | `UNCHANGED`, sin escritura |
| `LINK` con vínculo desvinculado de la misma persona | reactiva el vínculo; **no** habilita la cuenta |
| `LINK` con vínculo de otra persona | `CONFLICT` y cero cambios |
| `UNLINK` | marca `UNLINKED`, conserva la fila y revoca las sesiones vivas |
| `DISABLE_ACCOUNT` | deshabilita la cuenta y revoca las sesiones vivas |

`DISABLE_ACCOUNT` **no tiene operación inversa** en este comando: habilitar de
nuevo una cuenta es una decisión que esta Task no autoriza.

Cada operación es **atómica junto a su evento de auditoría**. Un archivo con
varias operaciones no es una transacción única: la salida dice exactamente
cuáles se aplicaron, y el comando termina con código distinto de cero si alguna
no lo hizo.

## Garantías de seguridad

- se conecta con `DATABASE_URL`, pero **adopta siempre** el rol
  `merdn_runtime` y fija `merdn.tenant_id` dentro de la transacción, y lo
  comprueba: las tablas de identidad llevan `FORCE ROW LEVEL SECURITY` y sin
  contexto no es visible ninguna fila;
- el rol de ejecución **no tiene `DELETE`** en ninguna tabla: este comando no
  puede borrar historia aunque se le pidiera;
- `issuer` se coteja contra la allowlist exacta de
  `MERDN_IDENTITY_PROVISIONING_ISSUERS`. Sin esa variable no se admite ningún
  emisor y el comando termina sin tocar la base;
- **nunca imprime** emisor, `subject`, nombres, documentos, contacto, cadenas de
  conexión, tokens ni secretos. Para correlacionar líneas se imprime una huella
  corta e irreversible del par emisor/`subject`;
- la auditoría escribe `actorType = SYSTEM`, sin actor y sin rol: el
  aprovisionamiento no es una persona y no se finge que lo sea.

## Verificación

```bash
npm run identity:provision:typecheck
```
