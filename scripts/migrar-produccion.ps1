#Requires -Version 7
<#
.SYNOPSIS
  Aplica las migraciones de Prisma pendientes contra la base de PRODUCCION.

.DESCRIPTION
  Sin -Aplicar solo informa: no escribe nada. Con -Aplicar ejecuta migrate deploy.

  Existe por un motivo concreto: `.env` y `.env.test` apuntan los dos a la rama
  Test de Frankfurt, y el CLI de Prisma lee `.env`. Un `prisma migrate deploy`
  lanzado a mano migra Test y deja produccion sin tocar, sin que nada avise.

.EXAMPLE
  pwsh -ExecutionPolicy Bypass -File scripts/migrar-produccion.ps1
  pwsh -ExecutionPolicy Bypass -File scripts/migrar-produccion.ps1 -Aplicar
#>
[CmdletBinding()]
param([switch]$Aplicar)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

# El punto inicial es deliberado: .gitignore usa el patron `.env*`, que solo casa
# con nombres que empiezan por punto. Sin el, este fichero con credenciales de
# produccion seria candidato a subir a un repo publico.
$tmp = ".env.produccion.tmp"

try {
    Write-Host "Descargando el entorno de produccion desde Vercel..." -ForegroundColor Cyan
    vercel env pull --environment=production --yes $tmp | Out-Null
    if (-not (Test-Path $tmp)) { throw "Vercel no genero $tmp" }

    $linea = Select-String -Path $tmp -Pattern '^DATABASE_URL=' | Select-Object -First 1
    if (-not $linea) { throw "No hay DATABASE_URL en el entorno de produccion" }

    $url = $linea.Line -replace '^DATABASE_URL=', '' -replace '^"', '' -replace '"$', ''
    $destino = ([Uri]$url).Host

    # Nunca se imprime la credencial: solo el host, que es lo que hay que confirmar.
    Write-Host "Host destino: $destino" -ForegroundColor Yellow

    if ($destino -match 'jolly-resonance') {
        throw "ABORTADO: ese endpoint es la rama Test de Frankfurt, no produccion."
    }
    if ($destino -notmatch 'eu-central-1') {
        Write-Host "AVISO: el host no parece estar en eu-central-1 (Frankfurt, ADR-007)." -ForegroundColor Red
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
    if (Test-Path $tmp) {
        Remove-Item $tmp -Force
        Write-Host "Fichero temporal de credenciales borrado." -ForegroundColor DarkGray
    }
}
