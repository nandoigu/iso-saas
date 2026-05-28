# Smoke tests

## Objetivo

Comprobar rapido que las rutas publicas cargan, las rutas protegidas redirigen a login sin sesion y una API basica responde como se espera.

## Uso

Produccion por defecto:

```powershell
npm run smoke
```

Contra un entorno local:

```powershell
$env:SMOKE_BASE_URL="http://127.0.0.1:3000"
npm run smoke
```

## Cobertura actual

- Publicas:
  - `/login`
  - `/register`
  - `/forgot-password`
- Protegidas sin sesion:
  - `/`
  - `/projects`
  - `/dashboard`
  - `/matrix`
  - `/profile`
  - `/admin`
- API:
  - `/api/auth/me` debe devolver `401` sin sesion.

## Notas

Estos tests no sustituyen una prueba funcional completa. Sirven como comprobacion rapida antes o despues de desplegar.
