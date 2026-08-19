param(
  [Parameter(Position = 0)]
  [ValidateSet('start', 'stop', 'status')]
  [string]$Action = 'status'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$dataDirectory = Join-Path $projectRoot '.local\postgres-data'
$logFile = Join-Path $projectRoot '.local\postgres.log'
$pgBin = if ($env:PG_BIN) { $env:PG_BIN } else { 'C:\Program Files\PostgreSQL\15\bin' }
$pgCtl = Join-Path $pgBin 'pg_ctl.exe'
$pgIsReady = Join-Path $pgBin 'pg_isready.exe'

if (-not (Test-Path -LiteralPath $pgCtl)) {
  throw "PostgreSQL pg_ctl.exe was not found. Set PG_BIN to your PostgreSQL bin directory."
}
if (-not (Test-Path -LiteralPath (Join-Path $dataDirectory 'PG_VERSION'))) {
  throw 'The isolated local database has not been initialized. Use Docker Compose or follow the local database setup in README.md.'
}

switch ($Action) {
  'start' {
    & $pgIsReady -h 127.0.0.1 -p 5433 -d rate_limiter
    if ($LASTEXITCODE -eq 0) {
      Write-Output 'Local PostgreSQL is already running on port 5433.'
      exit 0
    }
    & $pgCtl -D $dataDirectory -l $logFile -o '-p 5433 -h 127.0.0.1' -w start
    exit $LASTEXITCODE
  }
  'stop' {
    & $pgCtl -D $dataDirectory -m fast -w stop
    exit $LASTEXITCODE
  }
  'status' {
    & $pgIsReady -h 127.0.0.1 -p 5433 -d rate_limiter
    exit $LASTEXITCODE
  }
}
