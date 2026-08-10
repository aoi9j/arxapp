# ARX · nuevo acceso privado

## Flujo
1. La usuaria crea cuenta con email + contraseña.
2. Supabase envía el correo de verificación.
3. Tras verificar el email, vuelve a ARX.
4. ARX pide el código de acceso privado.
5. `ARX-MEMBER-1702` da rol `member`.
6. `ARX-FUNDADORA` da rol `founder`.
7. Los códigos no aparecen en el HTML: se validan mediante un RPC seguro de Supabase.

## Supabase
Ejecuta `arx_access_migration.sql` una sola vez en SQL Editor.

## GitHub
En la raíz del repositorio deben estar:
- `index.html`
- `arx-config.js`
- `manifest.json`
- `sw.js`
- iconos

No subas claves `sb_secret_...` ni `service_role`.

## Email de verificación
En Supabase, Authentication > URL Configuration, asegúrate de que la URL de tu GitHub Pages esté en las Redirect URLs. Para este proyecto:
`https://aoi9j.github.io/arxapp/`
