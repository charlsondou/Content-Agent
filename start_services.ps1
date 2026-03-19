<#
    Antigravity Services Startup Script (Node.js Version)
    ===================================
    1. Local Listener (Node.js) -> Runs in new window (Port 8888)
    2. Cloudflare Tunnel (Port 8888) -> Foreground
#>

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Write-Host "🚀 Starting Antigravity Automation Services..." -ForegroundColor Cyan

# 1. Start Node.js Listener (New Window)
$listenerParams = "local_listener.js" 
if (-Not (Test-Path $listenerParams)) {
    Write-Error "Error: local_listener.js not found."
    exit 1
}

Write-Host "✅ Starting Node.js Listener (Port 8888)..." -ForegroundColor Green
# Start Node.js in a new visible window so you can see the logs
Start-Process node -ArgumentList "$listenerParams"

# 2. Find cloudflared.exe recursively
Write-Host "🔍 Locating cloudflared.exe..." -ForegroundColor Cyan
$cloudflaredPath = Get-ChildItem -Path "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Filter "cloudflared.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName

if (-Not $cloudflaredPath) {
    Write-Host "❌ Error: 'cloudflared.exe' not found in WinGet packages." -ForegroundColor Red
    Pause
    exit 1
}

Write-Host "✅ Found: $cloudflaredPath" -ForegroundColor DarkGray
Write-Host "🌊 Establishing Cloudflare Tunnel..." -ForegroundColor Green
Write-Host "⚠️  Please COPY the https://... URL below for your Zeabur setup." -ForegroundColor Yellow
Write-Host "---------------------------------------------------"

& $cloudflaredPath tunnel --url http://127.0.0.1:8888
