param(
  [switch]$StatusOnly
)

$ErrorActionPreference = "Stop"

function Test-Command($Name) {
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Assert-Command($Name, $InstallHint) {
  if (-not (Test-Command $Name)) {
    Write-Error "$Name is not available. $InstallHint"
  }
}

function Get-RepoRoot {
  $scriptDir = Split-Path -Parent $PSCommandPath
  return (Resolve-Path (Join-Path $scriptDir "..")).Path
}

function Show-PortOwners($Ports) {
  $listeners = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $Ports -contains $_.LocalPort } |
    Select-Object LocalAddress, LocalPort, OwningProcess

  if (-not $listeners) {
    return $false
  }

  Write-Host "The following Jeepay ports are already in use:"
  $listeners | Format-Table -AutoSize

  foreach ($listener in $listeners) {
    Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)" |
      Select-Object ProcessId, Name, CommandLine |
      Format-List
  }

  return $true
}

$repoRoot = Get-RepoRoot
$jeepayRoot = Join-Path $repoRoot ".local\jeepay"
$serverDir = Join-Path $jeepayRoot "server"
$uiDir = Join-Path $jeepayRoot "jeepay-ui"
$ports = @(9216, 9217, 9218, 9226, 9227, 9228, 13306, 6380, 9876, 10909, 10911, 10912)

Assert-Command "docker" "Install Docker Desktop, reopen PowerShell, then rerun this script."

if (-not (Test-Path $serverDir)) {
  Assert-Command "git" "Install Git or clone https://github.com/jeequan/jeepay.git manually."
  New-Item -ItemType Directory -Path $jeepayRoot -Force | Out-Null
  git clone --depth 1 https://github.com/jeequan/jeepay.git $serverDir
}

if (-not (Test-Path $uiDir)) {
  Assert-Command "git" "Install Git or clone https://github.com/jeequan/jeepay-ui.git manually."
  New-Item -ItemType Directory -Path $jeepayRoot -Force | Out-Null
  git clone --depth 1 https://github.com/jeequan/jeepay-ui.git $uiDir
}

Push-Location $serverDir
try {
  if ($StatusOnly) {
    docker compose ps
    exit $LASTEXITCODE
  }

  if (Show-PortOwners $ports) {
    Write-Error "Free the occupied ports before starting Jeepay. This script will not stop unrelated processes."
  }

  docker compose up -d --build
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }

  docker compose ps
  Write-Host ""
  Write-Host "Jeepay URLs:"
  Write-Host "  Payment gateway: http://localhost:9216"
  Write-Host "  Cashier UI:      http://localhost:9226"
  Write-Host "  Manager UI:      http://localhost:9227  account: jeepay / jeepay123"
  Write-Host "  Merchant UI:     http://localhost:9228  create merchant in manager first; default password: jeepay666"
}
finally {
  Pop-Location
}
