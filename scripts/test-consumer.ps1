# Compatibility entry point; the acceptance harness itself is portable Node.js.
param([switch]$Reuse)
$ErrorActionPreference = 'Stop'
$taskRepo = Split-Path -Parent $PSScriptRoot
$taskNodeDirectory = Join-Path $taskRepo '.work/node-v24.21.0-win-x64'
if (Test-Path -LiteralPath (Join-Path $taskNodeDirectory 'node.exe')) {
  $env:PATH = $taskNodeDirectory + [IO.Path]::PathSeparator + $env:PATH
}
$taskArguments = @('--dir', $taskRepo, 'test:consumer')
if ($Reuse) { $taskArguments += '--reuse' }
& pnpm @taskArguments
exit $LASTEXITCODE
