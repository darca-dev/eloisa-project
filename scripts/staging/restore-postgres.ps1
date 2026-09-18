<#
.SYNOPSIS
  Restauracion de staging (Spec 023). Destructiva y nunca automatica.

.DESCRIPTION
  Restaura un volcado `custom` sobre una instancia de staging explicitamente
  confirmada. Antes de tocar la base verifica que el volcado sea estructuralmente
  legible (`pg_restore --list`) y, si existe el sidecar SHA-256 emitido por
  `backup-postgres.ps1`, que el digest coincida.

  La contrasena nunca viaja en `argv`: la URL administrativa se descompone en
  variables de proceso temporales (PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD)
  que se restauran al terminar.
#>
param([Parameter(Mandatory=$true)][string]$BackupFile,[switch]$DryRun,[string]$Environment='',[switch]$ConfirmRestore)
$ErrorActionPreference='Stop'
if ($Environment -ne 'staging') { throw 'Restore target must be explicitly staging.' }
if (-not $ConfirmRestore) { throw 'Destructive restore requires -ConfirmRestore.' }
if (-not (Test-Path -LiteralPath $BackupFile -PathType Leaf)) { throw 'Backup file does not exist.' }
if ([string]::IsNullOrWhiteSpace($env:DATABASE_URL)) { throw 'DATABASE_URL is required.' }
$resolved=[IO.Path]::GetFullPath($BackupFile)
$sidecar="$resolved.sha256"

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
  Write-Warning 'DESTRUCTIVE ACTION NOT EXECUTED'
  Write-Output "DRY-RUN restore source: $resolved"
  $sidecarState=if (Test-Path -LiteralPath $sidecar -PathType Leaf) { 'present' } else { 'absent' }
  Write-Output "DRY-RUN integrity plan: SHA-256 sidecar ($sidecarState) + pg_restore --list before any write"
  exit 0
}

# Integridad antes de destruir: sidecar SHA-256 cuando exista.
if (Test-Path -LiteralPath $sidecar -PathType Leaf) {
  $expected=((Get-Content -LiteralPath $sidecar -First 1) -split '\s+')[0].ToLowerInvariant()
  $actual=(Get-FileHash -LiteralPath $resolved -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($expected -ne $actual) { throw 'Backup SHA-256 sidecar mismatch: refusing destructive restore.' }
  Write-Output 'Integrity: SHA-256 sidecar OK.'
} else {
  Write-Warning 'No SHA-256 sidecar found next to the backup; integrity is only structural.'
}

$previous=@{}
foreach ($name in 'PGHOST','PGPORT','PGDATABASE','PGUSER','PGPASSWORD') { $previous[$name]=[Environment]::GetEnvironmentVariable($name,'Process') }
try {
  $env:PGHOST=$pgHost; $env:PGPORT=$pgPort; $env:PGDATABASE=$pgDatabase; $env:PGUSER=$pgUser; $env:PGPASSWORD=$pgPassword

  & pg_restore --list $resolved | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Backup integrity check failed: pg_restore --list exit code $LASTEXITCODE" }

  Write-Warning 'DESTRUCTIVE STAGING RESTORE STARTING'
  & pg_restore --exit-on-error --clean --if-exists $resolved
  if ($LASTEXITCODE -ne 0) { throw "pg_restore failed with exit code $LASTEXITCODE" }
} finally {
  $pgPassword=$null
  foreach ($name in $previous.Keys) { [Environment]::SetEnvironmentVariable($name,$previous[$name],'Process') }
}
Write-Output 'Staging restore completed.'
