# Build Forex Trading Consultants locally, then push a slim package to Lightsail.
# Use this when Grok Bot can't stay connected long enough to deploy.
#
# Run in PowerShell:
#   cd C:\Users\GEORGE\exnessfxbot
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy\build-and-push.ps1
#
# Optional:
#   -SkipBuild   upload the existing .next (must already have BUILD_ID)
#   -ClearLock   remove a stuck .next\lock before building

param(
  [switch]$SkipBuild,
  [switch]$ClearLock
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $Root "package.json"))) {
  $Root = "C:\Users\GEORGE\exnessfxbot"
}
Set-Location $Root

Write-Host "Root: $Root" -ForegroundColor Cyan

if ($ClearLock) {
  Get-ChildItem ".next" -Filter "*lock*" -Force -ErrorAction SilentlyContinue |
    ForEach-Object {
      Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue
      Write-Host "Removed $($_.Name)"
    }
}

if (-not $SkipBuild) {
  # Stale lock with no live build blocks next build.
  $busy = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and ($_.CommandLine -match 'next.*build|npm-cli.js" run build') }
  if (-not $busy -and (Test-Path ".next\lock")) {
    Remove-Item ".next\lock" -Force
    Write-Host "Cleared stale .next\lock"
  }

  Write-Host "Building production .next ..." -ForegroundColor Cyan
  npm run build
  if (-not (Test-Path ".next\BUILD_ID")) {
    throw "Build finished but .next\BUILD_ID is missing."
  }
  Write-Host ("BUILD_ID=" + (Get-Content ".next\BUILD_ID" -Raw).Trim()) -ForegroundColor Green
} else {
  if (-not (Test-Path ".next\BUILD_ID")) {
    throw "SkipBuild set but .next\BUILD_ID is missing. Run without -SkipBuild."
  }
  Write-Host ("SkipBuild — using BUILD_ID=" + (Get-Content ".next\BUILD_ID" -Raw).Trim()) -ForegroundColor Yellow
}

# Keep the Lightsail tarball small (dev/cache once bloated uploads to ~450MB+).
foreach ($dir in @(".next\cache", ".next\dev")) {
  if (Test-Path $dir) {
    Remove-Item $dir -Recurse -Force
    Write-Host "Removed $dir"
  }
}

$Push = Join-Path $Root "deploy\push-to-lightsail.ps1"
if (-not (Test-Path $Push)) { throw "Missing $Push" }

Write-Host "Pushing slim package to Lightsail ..." -ForegroundColor Cyan
& powershell -NoProfile -ExecutionPolicy Bypass -File $Push
if ($LASTEXITCODE -ne 0) { throw "push-to-lightsail.ps1 failed (exit $LASTEXITCODE)" }

Write-Host ""
Write-Host "Done. Live: https://forextradingconsultants.com" -ForegroundColor Green
Write-Host "Quick check: open the site and hard-refresh (Ctrl+F5)." -ForegroundColor DarkGray
