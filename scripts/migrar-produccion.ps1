#Requires -Version 7
<#
.SYNOPSIS
  Aplica las migraciones de Prisma pendientes contra la base de PRODUCCION.

.DESCRIPTION
  Sin -Aplicar solo informa: no escribe nada. Con -Aplicar ejecuta migrate deploy.

  Existe por dos motivos concretos:

  1. El build de Vercel es `prisma generate && next build`: NO aplica migraciones.
     Un push a main despliega codigo nuevo contra una base sin migrar.

  2. `.env` y `.env.test` apuntan los dos a la rama Test de Frankfurt, y el CLI de
     Prisma lee `.env`. Un `prisma migrate deploy` lanzado a mano migra Test y deja
     produccion rota igual, sin que nada avise.

  La cadena de conexion se pide a Neon, no a Vercel: las variables de produccion de
  Vercel estan marcadas como sensibles y `vercel env pull` devuelve "[SENSITIVE]"
  en vez del valor (verificado el 2026-09-03).

.EXAMPLE
  pwsh -ExecutionPolicy Bypass -File scripts/migrar-produccion.ps1
  pwsh -ExecutionPolicy Bypass -File scripts/migrar-produccion.ps1 -Aplicar
#>
[CmdletBinding()]
param([switch]$Aplicar)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

# Proyecto y rama de produccion en Neon (ADR-007, Frankfurt).
$proyecto = "late-hat-22164008"
$rama = "production"

# Endpoints conocidos. El de Test existe aqui para poder ABORTAR si aparece.
$endpointProduccion = "ep-empty-dawn-b28leeni"
$endpointTest = "ep-jolly-resonance-b2y3s9ni"

$neonExe = "npx"
$neonArgs = @("--yes", "neonctl@latest")
if (Get-Command neonctl -ErrorAction SilentlyContinue) {
    $neonExe = "neonctl"
    $neonArgs = @()
}

try {
    Write-Host "Pidiendo a Neon la cadena de conexion de produccion..." -ForegroundColor Cyan

    # Sin --output: solo admite json, yaml y table (verificado en --help el 3-sep),
    # y el formato por defecto ya imprime la URI en una linea.
    $url = (& $neonExe @($neonArgs + @(
        "connection-string", $rama,
        "--project-id", $proyecto
    )) 2>&1 | Where-Object { $_ -match '^postgres' } | Select-Object -Last 1)

    if (-not $url -or $url -notmatch '^postgres') {
        throw @"
Neon no devolvio una cadena de conexion valida.

Devolvio: $url

Si dice que falta autenticacion, inicia sesion una vez con

    npx --yes neonctl@latest auth

y vuelve a lanzar este script.
"@
    }

    $uri = [Uri]$url
    $destino = $uri.Host
    $baseDatos = $uri.AbsolutePath.TrimStart('/')

    # Nunca se imprime la credencial: solo host y base, que es lo que hay que confirmar.
    Write-Host "Host destino: $destino" -ForegroundColor Yellow
    Write-Host "Base de datos: $baseDatos" -ForegroundColor Yellow

    if ($destino -match $endpointTest) {
        throw "ABORTADO: ese endpoint es la rama Test de Frankfurt, no produccion."
    }
    if ($destino -notmatch $endpointProduccion) {
        throw "ABORTADO: el host no es el endpoint de produccion conocido ($endpointProduccion). Verificar antes de escribir."
    }

    $env:DATABASE_URL = $url

    Write-Host "`n--- Estado de las migraciones en produccion ---" -ForegroundColor Cyan
    npx prisma migrate status

    if (-not $Aplicar) {
        Write-Host "`nSolo informe. Para aplicarlas, repite con -Aplicar" -ForegroundColor Green
        return
    }

    Write-Host "`n--- Aplicando ---" -ForegroundColor Cyan
    npx prisma migrate deploy

    Write-Host "`n--- Estado final ---" -ForegroundColor Cyan
    npx prisma migrate status
}
finally {
    $env:DATABASE_URL = $null
}
