# Deploy Forex Trading Consultants to the existing Lightsail box (beside serpal.xyz).
# Does NOT upload: .env.local, mt5.json, member-mt5.json, users.json, payments.json.
# Does NOT set LIVE_SITE_URL on the server (PC admin pushes cards to the live site).
$ErrorActionPreference = "Stop"

$Key = "C:\Users\GEORGE\serpai\downloads\LightsailDefaultKey-eu-central-1.pem"
$HostName = "ubuntu@63.184.44.34"
$LocalRoot = "C:\Users\GEORGE\exnessfxbot"
$Tar = Join-Path $env:TEMP "ftc-deploy.tgz"
$EnvOut = Join-Path $env:TEMP "ftc.env.local"
$LocalEnv = Join-Path $LocalRoot ".env.local"
$Setup = Join-Path $LocalRoot "deploy\remote-setup.sh"
$Caddy = Join-Path $LocalRoot "deploy\Caddyfile"

if (-not (Test-Path $Key)) { throw "SSH key missing: $Key" }
if (-not (Test-Path $LocalEnv)) { throw "Missing $LocalEnv" }
if (-not (Test-Path $Setup)) { throw "Missing $Setup" }
if (-not (Test-Path $Caddy)) { throw "Missing $Caddy" }

function Get-DotEnvValue([string]$Path, [string]$KeyName) {
  foreach ($line in Get-Content -Path $Path) {
    $trim = $line.Trim()
    if (-not $trim -or $trim.StartsWith("#")) { continue }
    $idx = $trim.IndexOf("=")
    if ($idx -lt 1) { continue }
    $k = $trim.Substring(0, $idx).Trim()
    if ($k -eq $KeyName) {
      return $trim.Substring($idx + 1).Trim().Trim('"').Trim("'")
    }
  }
  return ""
}

$admin = Get-DotEnvValue $LocalEnv "ADMIN_SECRET"
$session = Get-DotEnvValue $LocalEnv "SESSION_SECRET"
$sync = Get-DotEnvValue $LocalEnv "LIVE_SYNC_SECRET"
$tgChannel = Get-DotEnvValue $LocalEnv "TELEGRAM_CHANNEL"
$smtpHost = Get-DotEnvValue $LocalEnv "SMTP_HOST"
$smtpPort = Get-DotEnvValue $LocalEnv "SMTP_PORT"
$smtpUser = Get-DotEnvValue $LocalEnv "SMTP_USER"
$smtpPass = Get-DotEnvValue $LocalEnv "SMTP_PASS"
$smtpFrom = Get-DotEnvValue $LocalEnv "SMTP_FROM"
$smtpSecure = Get-DotEnvValue $LocalEnv "SMTP_SECURE"
if (-not $admin) { throw "ADMIN_SECRET missing in .env.local" }
if (-not $session) { throw "SESSION_SECRET missing in .env.local" }
if (-not $sync) { throw "LIVE_SYNC_SECRET missing in .env.local" }
if (-not $tgChannel) { $tgChannel = "@TradeBossFx" }
if (-not $smtpPort) { $smtpPort = "587" }
if (-not $smtpSecure) { $smtpSecure = "0" }
if (-not $smtpFrom -and $smtpUser) { $smtpFrom = "Forex Trading Consultants <$smtpUser>" }

$envLines = @(
  "SITE_URL=https://forextradingconsultants.com"
  "APP_URL=https://forextradingconsultants.com"
  "ADMIN_SECRET=$admin"
  "SESSION_SECRET=$session"
  "LIVE_SYNC_SECRET=$sync"
  "TELEGRAM_CHANNEL=$tgChannel"
)
if ($smtpHost -and $smtpUser -and $smtpPass) {
  $envLines += @(
    "SMTP_HOST=$smtpHost"
    "SMTP_PORT=$smtpPort"
    "SMTP_USER=$smtpUser"
    "SMTP_PASS=$smtpPass"
    "SMTP_FROM=$smtpFrom"
    "SMTP_SECURE=$smtpSecure"
  )
}
Set-Content -Path $EnvOut -Value $envLines -Encoding ascii

Write-Host "Packing $LocalRoot ..."
if (Test-Path $Tar) { Remove-Item $Tar -Force }
Push-Location $LocalRoot
try {
  tar -czf $Tar `
    --exclude=node_modules `
    --exclude=.next `
    --exclude=.git `
    --exclude=.env `
    --exclude=.env.local `
    --exclude=.env.production `
    --exclude=data/mt5.json `
    --exclude=data/member-mt5.json `
    --exclude=data/mt5-queue.json `
    --exclude=data/mt5-status.json `
    --exclude=data/mt5-quotes.json `
    --exclude=data/mt5-quotes.json.tmp `
    --exclude=data/mt5-trails.json `
    --exclude=data/mt5-pnl.json `
    --exclude=data/mt5-executor.log `
    --exclude=data/telegram-poster.log `
    --exclude=data/telegram-poster.pid `
    --exclude=data/telegram-queue.json `
    --exclude=data/users.json `
    --exclude=data/payments.json `
    --exclude=data/last-verify-link.txt `
    --exclude=scripts/__pycache__ `
    --exclude=mobile `
    --exclude=*.pem `
    .
} finally {
  Pop-Location
}

$SshOpts = @("-i", $Key, "-o", "StrictHostKeyChecking=yes", "-o", "ServerAliveInterval=30", "-o", "ServerAliveCountMax=20")

Write-Host "Uploading ..."
scp @SshOpts $Tar "${HostName}:/tmp/ftc-deploy.tgz"
scp @SshOpts $EnvOut "${HostName}:/tmp/ftc.env.local"
scp @SshOpts $Caddy "${HostName}:/tmp/ftc-Caddyfile"
scp @SshOpts $Setup "${HostName}:/tmp/ftc-setup.sh"

Write-Host "Building and starting on Lightsail (several minutes)..."
ssh @SshOpts $HostName 'sed -i "s/\r$//" /tmp/ftc-setup.sh /tmp/ftc-Caddyfile /tmp/ftc.env.local && chmod +x /tmp/ftc-setup.sh && bash /tmp/ftc-setup.sh'

Remove-Item $Tar, $EnvOut -Force -ErrorAction SilentlyContinue
Write-Host "Deployed. Public URL https://forextradingconsultants.com (needs Cloudflare A records)."
