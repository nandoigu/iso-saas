# Saneado del catalogo RequirementTemplate en PRODUCCION (Frankfurt).
#
#   1. Borra las 85 plantillas con rol 'general'
#   2. Borra la fila sobrante  adjudicatario | 19650-2 | 5.7.2
#   3. Corrige la descripcion de adjudicador | 19650-2 | 5.2.2
#
# Deja el catalogo en 91 plantillas, identicas a los Excel de docs/fuentes.
#
# La credencial se toma del CLI de Neon y vive solo en memoria: no se escribe en
# ningun fichero ni se imprime en pantalla.
#
# Uso:
#   pwsh -ExecutionPolicy Bypass -File scripts\sanear-catalogo-produccion.ps1
#   pwsh -ExecutionPolicy Bypass -File scripts\sanear-catalogo-produccion.ps1 -Aplicar

param([switch]$Aplicar, [switch]$Comparar)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host "Pidiendo la cadena de conexion de produccion a Neon..." -ForegroundColor Cyan
$cs = (cmd /c "npx neonctl connection-string production --project-id late-hat-22164008 --org-id org-old-pine-16355498" | Select-Object -Last 1)

if (-not $cs -or -not $cs.StartsWith("postgres")) {
    Write-Host "ABORTADO: no se obtuvo cadena de conexion. Ejecuta antes: npx neonctl auth" -ForegroundColor Red
    exit 1
}

# Guarda de jurisdiccion (ADR-007): produccion vive en Frankfurt.
if (-not $cs.Contains("eu-central-1")) {
    Write-Host "ABORTADO: la cadena no apunta a eu-central-1. No se escribe nada." -ForegroundColor Red
    exit 1
}

# Guarda de destino: que no sea la rama Test por error.
if ($cs.Contains("jolly-resonance")) {
    Write-Host "ABORTADO: esa cadena es la rama Test, no produccion." -ForegroundColor Red
    exit 1
}

$env:SANEAR_DATABASE_URL = $cs

if ($Comparar) {
    # Verificacion completa: las 91 plantillas de produccion contra los Excel de
    # docs/fuentes, texto incluido. Un recuento no detecta una descripcion mal.
    Write-Host "`nCOMPARANDO produccion contra docs/fuentes (solo lectura)`n" -ForegroundColor Green
    $env:DUMP_DATABASE_URL = $cs
    node scripts/comparar-fuente-vs-base.mjs
    Remove-Item Env:\DUMP_DATABASE_URL -ErrorAction SilentlyContinue
    Remove-Item Env:\SANEAR_DATABASE_URL -ErrorAction SilentlyContinue
    exit 0
}

if ($Aplicar) {
    Write-Host "`nAPLICANDO sobre produccion...`n" -ForegroundColor Yellow
    node scripts/sanear-catalogo-requisitos.mjs --apply
} else {
    Write-Host "`nINSPECCION (no escribe nada)`n" -ForegroundColor Green
    node scripts/sanear-catalogo-requisitos.mjs
    Write-Host "`nPara ejecutarlo de verdad, repite con  -Aplicar" -ForegroundColor Yellow
}

Remove-Item Env:\SANEAR_DATABASE_URL -ErrorAction SilentlyContinue
