<#
.SYNOPSIS
  Backup logico de staging (Spec 023). NO cifra el volcado.

.DESCRIPTION
  Genera un volcado `custom` de PostgreSQL, verifica que sea estructuralmente
  legible con `pg_restore --list` y emite un sidecar SHA-256 para integridad.

  Este script NO produce un backup cifrado. La confidencialidad se obtiene
  almacenando el volcado y su sidecar en un destino de staging externo cifrado
  y de acceso restringido; ver `docs/runbooks/STAGING_DEPLOYMENT.md`.

  La contrasena nunca viaja en `argv`: la URL administrativa se descompone en
  variables de proceso temporales (PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD)
  que se restauran al terminar.
#>
param([Parameter(Mandatory=$true)][string]$OutputDirectory,[switch]$DryRun,[string]$Environment='')
$ErrorActionPreference='Stop'
if ($Environment -ne 'staging') { throw 'Explicit -Environment staging confirmation is required.' }
if ([string]::IsNullOrWhiteSpace($env:DATABASE_URL)) { throw 'DATABASE_URL is required.' }
$resolved=[IO.Path]::GetFullPath($OutputDirectory)
if ($resolved -eq [IO.Path]::GetPathRoot($resolved)) { throw 'Refusing filesystem-root backup destination.' }
$file=Join-Path $resolved ("merdn-staging-{0}.dump" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
# Descomposicion sin registro: ningun componente de la URL se imprime.
$uri=$null
if (-not [uri]::TryCreate($env:DATABASE_URL,[UriKind]::Absolute,[ref]$uri)) { throw 'DATABASE_URL is not a parsable connection URL.' }
if ([string]::IsNullOrWhiteSpace($uri.Host) -or [string]::IsNullOrEmpty($uri.UserInfo)) { throw 'DATABASE_URL must carry host and credentials.' }
$userInfo=$uri.UserInfo.Split(':',2)
if ($userInfo.Count -lt 2) { throw 'DATABASE_URL must carry host and credentials.' }
$pgHost=$uri.Host
$pgPort=if ($uri.Port -gt 0) { [string]$uri.Port } else { '5432' }
$pgDatabase=[uri]::UnescapeDataString($uri.AbsolutePath.TrimStart('/'))
if ([string]::IsNullOrWhiteSpace($pgDatabase)) { throw 'DATABASE_URL must name a database.' }
$pgUser=[uri]::UnescapeDataString($userInfo[0])
$pgPassword=[uri]::UnescapeDataString($userInfo[1])

if ($DryRun) {
  Write-Output "DRY-RUN backup target: $file"
  Write-Output "DRY-RUN integrity plan: pg_restore --list + SHA-256 sidecar '$file.sha256'"
  Write-Output 'DRY-RUN note: this script does not encrypt; store the dump in encrypted restricted staging storage.'
  exit 0
}

$previous=@{}
foreach ($name in 'PGHOST','PGPORT','PGDATABASE','PGUSER','PGPASSWORD') { $previous[$name]=[Environment]::GetEnvironmentVariable($name,'Process') }
try {
  $env:PGHOST=$pgHost; $env:PGPORT=$pgPort; $env:PGDATABASE=$pgDatabase; $env:PGUSER=$pgUser; $env:PGPASSWORD=$pgPassword
  New-Item -ItemType Directory -Path $resolved -Force | Out-Null

  & pg_dump --format=custom --file=$file
  if ($LASTEXITCODE -ne 0) { throw "pg_dump failed with exit code $LASTEXITCODE" }

  # Integridad 1: el volcado debe ser estructuralmente legible en su formato.
  & pg_restore --list $file | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Backup integrity check failed: pg_restore --list exit code $LASTEXITCODE" }
} finally {
  $pgPassword=$null
  foreach ($name in $previous.Keys) { [Environment]::SetEnvironmentVariable($name,$previous[$name],'Process') }
}

# Integridad 2: sidecar SHA-256 junto al volcado.
$sidecar="$file.sha256"
$digest=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
Set-Content -LiteralPath $sidecar -Value ("{0}  {1}" -f $digest,[IO.Path]::GetFileName($file)) -Encoding ascii

Write-Output "Backup completed: $file"
Write-Output "Integrity: pg_restore --list OK; SHA-256 sidecar: $sidecar"
Write-Output 'NOT ENCRYPTED by this script. Store dump and sidecar in encrypted, access-restricted external staging storage.'
