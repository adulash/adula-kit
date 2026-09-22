param([switch]$Stop, [string]$BinDirectory = 'C:\Program Files\PostgreSQL\17\bin')
$ErrorActionPreference = 'Stop'
$adulaRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$adulaWork = Join-Path $adulaRoot '.work'
$adulaData = [IO.Path]::GetFullPath((Join-Path $adulaWork 'pgdata'))
if (-not $adulaData.StartsWith($adulaRoot + [IO.Path]::DirectorySeparatorChar)) { throw 'Invalid database directory' }
if (-not (Test-Path -LiteralPath (Join-Path $BinDirectory 'pg_ctl.exe'))) { throw 'PostgreSQL 17 binaries were not found. Set -BinDirectory or use Docker Compose.' }
if ($Stop) { & (Join-Path $BinDirectory 'pg_ctl.exe') -D $adulaData stop -m fast; exit $LASTEXITCODE }
New-Item -ItemType Directory -Force -Path $adulaWork | Out-Null
if (-not (Test-Path -LiteralPath (Join-Path $adulaData 'PG_VERSION'))) {
  $adulaPassword = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(24))
  Set-Content -LiteralPath (Join-Path $adulaWork 'pgpass') -Value $adulaPassword -NoNewline
  Set-Content -LiteralPath (Join-Path $adulaWork 'test-database.json') -Value (@{ host='127.0.0.1'; port=55432; user='adula'; password=$adulaPassword; database='adula_test' } | ConvertTo-Json)
  & (Join-Path $BinDirectory 'initdb.exe') -D $adulaData -U adula -A scram-sha-256 "--pwfile=$(Join-Path $adulaWork 'pgpass')" --encoding=UTF8 --locale=C
  if ($LASTEXITCODE -ne 0) { throw 'Database initialization failed' }
}
& (Join-Path $BinDirectory 'pg_ctl.exe') -D $adulaData status
if ($LASTEXITCODE -ne 0) { & (Join-Path $BinDirectory 'pg_ctl.exe') -D $adulaData -l (Join-Path $adulaWork 'postgres.log') -o '-p 55432 -h 127.0.0.1' start }
