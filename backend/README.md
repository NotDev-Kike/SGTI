# SGTI backend

## Configuración

Configure `DATABASE_URL` y una clave estable `AUTH_TOKEN_SECRET` en el entorno del backend. En producción, mantenga la misma clave entre reinicios para que las sesiones sigan siendo válidas.

Las sesiones duran ocho horas. El registro público solo crea usuarios con rol `usuario_final`; los roles administrativos se provisionan con `npm run bootstrap:admins`.

Para el aprovisionamiento inicial, configure `ADMIN_GERENCIA_EMAIL`, `ADMIN_GERENCIA_PASSWORD`, `ADMIN_INFRA_EMAIL`, `ADMIN_INFRA_PASSWORD`, `ADMIN_GPS_EMAIL`, `ADMIN_GPS_PASSWORD`, `ADMIN_DESARROLLO_EMAIL` y `ADMIN_DESARROLLO_PASSWORD`. Las contraseñas se almacenan con hash. Si el correo ya existe, el proceso asigna el rol y área configurados sin cambiar su contraseña.

## Chat directo

Aplicar una vez la migración aditiva antes de habilitar el chat directo:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/001_direct_chat.sql
```