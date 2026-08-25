# Same toolchain as SerpAi (see serpai/APK-BUILD-PROGRESS.txt).
$ErrorActionPreference = "Stop"
$env:JAVA_HOME = "C:\Users\GEORGE\tools\jdk-21"
$env:ANDROID_HOME = "C:\Users\GEORGE\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

if (-not (Test-Path "$env:JAVA_HOME\bin\java.exe")) { throw "JDK missing: $env:JAVA_HOME" }
if (-not (Test-Path $env:ANDROID_HOME)) { throw "Android SDK missing: $env:ANDROID_HOME" }

Write-Host "Using JAVA_HOME=$env:JAVA_HOME"
& "$env:JAVA_HOME\bin\java.exe" -version

if (-not (Test-Path "node_modules")) {
  npm install
}

npx cap sync android
python scripts\make-icons.py

Set-Location (Join-Path $Root "android")
if (-not (Test-Path "local.properties")) {
  Set-Content -Path "local.properties" -Value "sdk.dir=C:/Users/GEORGE/Android/Sdk" -Encoding ascii
}

.\gradlew.bat assembleDebug --no-daemon
$apk = Join-Path $Root "android\app\build\outputs\apk\debug\app-debug.apk"
if (-not (Test-Path $apk)) { throw "APK was not produced" }

$destDir = Join-Path (Split-Path $Root) "public\download"
New-Item -ItemType Directory -Force -Path $destDir | Out-Null
$dest = Join-Path $destDir "forex-trading-consultants.apk"
Copy-Item $apk $dest -Force
Write-Host "APK: $dest"
Write-Host ("Size: {0:N2} MB" -f ((Get-Item $dest).Length / 1MB))
