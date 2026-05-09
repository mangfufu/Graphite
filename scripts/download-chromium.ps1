# download-chromium.ps1
# Downloads Chromium for bundling with the app
# Run this before building: powershell -ExecutionPolicy Bypass -File scripts/download-chromium.ps1

$ErrorActionPreference = "Stop"

$version = "1000022"  # Chromium snapshot version
$outDir = "src-tauri/chromium"

# Determine platform
$os = if ($IsWindows -or $env:OS -eq "Windows_NT") { "win" }
      elseif ($IsMacOS) { "mac" }
      else { "linux" }

$url = switch ($os) {
    "win"  { "https://storage.googleapis.com/chromium-browser-snapshots/Win_x64/$version/chrome-win.zip" }
    "mac"  { "https://storage.googleapis.com/chromium-browser-snapshots/Mac/$version/chrome-mac.zip" }
    "linux" { "https://storage.googleapis.com/chromium-browser-snapshots/Linux_x64/$version/chrome-linux.zip" }
}

$zipFile = "$outDir/chromium.zip"

# Check if already downloaded
$markerFile = "$outDir/.downloaded"
if (Test-Path $markerFile) {
    Write-Host "Chromium already downloaded."
    exit 0
}

# Create output directory
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

Write-Host "Downloading Chromium from $url..."
$progressPreference = 'SilentlyContinue'
Invoke-WebRequest -Uri $url -OutFile $zipFile

Write-Host "Extracting Chromium..."
Expand-Archive -Path $zipFile -DestinationPath $outDir -Force

# Clean up zip
Remove-Item -Path $zipFile

# Create marker file
Set-Content -Path $markerFile -Value "ok"

Write-Host "Chromium downloaded to $outDir"
Get-ChildItem -Path $outDir -Directory | ForEach-Object { Write-Host "  - $($_.Name)" }
