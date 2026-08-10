# =============================================================================
#  BAOS / P4  -  Mover el store de Vercel Blob a Frankfurt (fra1)
#  Motivo: ADR-007 situa datos y computo en la UE. El store actual esta en
#          iad1 (Washington) y la region de un store es INMUTABLE: no se
#          cambia, se crea otro.
#
#  Estado verificado el 2026-08-10:
#    iso-saas-evidence  store_SPJ4WiRGmr7N39TV  iad1  0 B  0 files  40d
#    -> El store esta VACIO. No hay nada que migrar.
#
#  Ejecutar:  pwsh -ExecutionPolicy Bypass -File .\baos-blob-a-frankfurt.ps1
# =============================================================================

$ErrorActionPreference = 'Stop'

$Proyecto   = 'C:\Users\ferna\prueba-app'
$StoreViejo = 'store_SPJ4WiRGmr7N39TV'
$StoreNuevo = 'iso-saas-evidence-fra'
$Region     = 'fra1'

Set-Location $Proyecto

# --- 1. Copia de seguridad de .env.local -------------------------------------
# GOTCHA DOCUMENTADO: los comandos "vercel blob" disparan un "vercel env pull"
# que SOBRESCRIBE .env.local entero. Sin esta copia se pierden los secretos
# que solo existan en local.

# La copia va a la raiz del proyecto CON PUNTO INICIAL a proposito: .gitignore
# tiene el patron ".env*", asi que git la ignora sola. Un nombre sin punto
# (env.local.backup-...) NO casa con ese patron y acabaria subiendo secretos
# a un repositorio publico.
$stamp  = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $Proyecto ".env.local.backup-$stamp"

if (Test-Path .env.local) {
    Copy-Item .env.local $backup
    $clavesAntes = (Get-Content .env.local | Select-String '^[A-Z_]+=' |
                    ForEach-Object { ($_ -split '=')[0] })
    Write-Host "[1/6] Copia de seguridad -> $backup" -ForegroundColor Green
    Write-Host "      Claves guardadas: $($clavesAntes -join ', ')"
} else {
    $clavesAntes = @()
    Write-Host "[1/6] No hay .env.local que copiar" -ForegroundColor Yellow
}

# --- 2. Estado actual --------------------------------------------------------
Write-Host "`n[2/6] Stores antes del cambio:" -ForegroundColor Cyan
npx vercel blob list-stores --non-interactive

# --- 3. Confirmacion ---------------------------------------------------------
Write-Host "`n[3/6] Se va a BORRAR $StoreViejo (iad1, vacio) y crear" -ForegroundColor Yellow
Write-Host "      '$StoreNuevo' en $Region, privado, en los 3 entornos." -ForegroundColor Yellow
$resp = Read-Host "      Escribe SI para continuar"
if ($resp -ne 'SI') { Write-Host 'Cancelado.' -ForegroundColor Red; exit 1 }

# --- 4. Borrar el store de Washington ----------------------------------------
# Se borra ANTES de crear el nuevo para que BLOB_READ_WRITE_TOKEN apunte sin
# ambiguedad a Frankfurt. Con dos stores vinculados al mismo proyecto, esa
# variable queda indeterminada.
Write-Host "`n[4/6] Borrando $StoreViejo ..." -ForegroundColor Cyan
npx vercel blob delete-store $StoreViejo --yes --non-interactive
if ($LASTEXITCODE -ne 0) { Write-Host 'Fallo al borrar. Abortado.' -ForegroundColor Red; exit 1 }

# --- 5. Crear el store en Frankfurt ------------------------------------------
# --region es OBLIGATORIO ponerlo: su valor por defecto es iad1, y omitirlo
# es exactamente como se creo el store en Washington sin que nadie lo notara.
Write-Host "`n[5/6] Creando '$StoreNuevo' en $Region ..." -ForegroundColor Cyan
npx vercel blob create-store $StoreNuevo `
    --access private `
    --region $Region `
    --environment production `
    --environment preview `
    --environment development `
    --non-interactive
if ($LASTEXITCODE -ne 0) { Write-Host 'Fallo al crear.' -ForegroundColor Red; exit 1 }

# --- 6. VERIFICAR LO CREADO, no lo pedido ------------------------------------
# Un flag mal escrito no da error: se ignora en silencio. La unica prueba
# valida es leer la region del store ya creado.
Write-Host "`n[6/6] Verificacion:" -ForegroundColor Cyan
$salida = npx vercel blob list-stores --non-interactive 2>&1 | Out-String

Write-Host $salida

if ($salida -match [regex]::Escape($StoreNuevo) -and $salida -match $Region) {
    Write-Host "OK: '$StoreNuevo' aparece en la region $Region." -ForegroundColor Green
} else {
    Write-Host "ATENCION: no se confirma $Region en el listado. REVISAR." -ForegroundColor Red
}
if ($salida -match 'iad1') {
    Write-Host "ATENCION: todavia aparece algo en iad1. REVISAR." -ForegroundColor Red
}

# --- Comprobar que el env pull no se ha comido ningun secreto ----------------
if ($clavesAntes.Count -gt 0 -and (Test-Path .env.local)) {
    $clavesDespues = (Get-Content .env.local | Select-String '^[A-Z_]+=' |
                      ForEach-Object { ($_ -split '=')[0] })
    $perdidas = $clavesAntes | Where-Object { $_ -notin $clavesDespues }
    if ($perdidas) {
        Write-Host "`nATENCION: .env.local ha perdido estas claves:" -ForegroundColor Red
        Write-Host "  $($perdidas -join ', ')"
        Write-Host "  Recuperalas de: $backup" -ForegroundColor Yellow
    } else {
        Write-Host "`n.env.local conserva todas sus claves." -ForegroundColor Green
    }
}

Write-Host "`nHecho. Pega la salida en la sesion de Claude para actualizar los documentos." -ForegroundColor Cyan
