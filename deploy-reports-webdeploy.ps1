# ============================================================================
#  Deploy PosReports.Web to posreporting.tryasp.net using WEB DEPLOY (msdeploy).
#
#  How to run:
#    powershell -ExecutionPolicy Bypass -File .\deploy-reports-webdeploy.ps1
#
#  It asks only for the Web Deploy password (panel -> site73506 -> WebDeploy
#  access). Nothing is stored. Everything else is filled in and can be
#  overridden with -Server / -SiteName / -UserName if the panel ever changes.
#
#  Why Web Deploy rather than FTP: one authenticated sync instead of ~100
#  separate connections, and it REMOVES files on the server that are no longer
#  in the build. That matters for this app - Angular names every bundle with a
#  content hash, so an FTP copy leaves the previous deploy's chunks behind
#  forever and the site root grows with dead files on every release.
#
#  ASCII ONLY, ON PURPOSE: Windows PowerShell 5.1 reads a .ps1 with no
#  byte-order mark as ANSI, so a stray non-ASCII character breaks parsing.
# ============================================================================

[CmdletBinding()]
param(
    [string]$Server   = 'site73506.siteasp.net',
    [int]   $Port     = 8172,
    [string]$SiteName = 'site73506',
    [string]$UserName = 'site73506',
    # Preview what would change without touching the server.
    [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'

# ---- 1. locate the build --------------------------------------------------
$distRoot  = Join-Path $PSScriptRoot 'dist\pos-reports-web'
$localRoot = Join-Path $distRoot 'browser'
if (-not (Test-Path $localRoot)) { $localRoot = $distRoot }

if (-not (Test-Path (Join-Path $localRoot 'index.html'))) {
    Write-Host "No index.html in $localRoot - build first:  npm run build" -ForegroundColor Yellow
    exit 1
}

# web.config is not emitted by Angular, and without it IIS answers a refresh on
# /takeaway-day with a 404 because it looks for a folder by that name.
$webConfig = Join-Path $PSScriptRoot 'web.config'
if ((Test-Path $webConfig) -and -not (Test-Path (Join-Path $localRoot 'web.config'))) {
    Copy-Item $webConfig (Join-Path $localRoot 'web.config') -Force
    Write-Host 'web.config included (SPA deep links).' -ForegroundColor DarkCyan
}

# ---- 2. locate msdeploy ---------------------------------------------------
$msdeploy = @(
    "$env:ProgramFiles\IIS\Microsoft Web Deploy V3\msdeploy.exe",
    "${env:ProgramFiles(x86)}\IIS\Microsoft Web Deploy V3\msdeploy.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $msdeploy) {
    Write-Host 'msdeploy.exe not found. Install "Web Deploy 3.6" or use deploy-reports-ftp.ps1.' -ForegroundColor Yellow
    exit 1
}

# ---- 3. stage to a path with NO SPACES ------------------------------------
# msdeploy mangles source paths containing spaces, and this project lives under
# "D:\Apex work\...". A previous deploy in this stack was lost to exactly that,
# so stage the files somewhere plain first and sync from there.
$stage = Join-Path $env:TEMP 'posreports-deploy'
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage -Force | Out-Null
Copy-Item (Join-Path $localRoot '*') $stage -Recurse -Force

$count = @(Get-ChildItem $stage -Recurse -File).Count
Write-Host ""
Write-Host "Staged $count files -> $stage" -ForegroundColor Cyan
Write-Host "Target: https://${Server}:$Port  site '$SiteName'" -ForegroundColor Cyan

# ---- 4. credentials (typed now, never stored) -----------------------------
$secure = Read-Host 'Web Deploy password' -AsSecureString
$pass   = [System.Net.NetworkCredential]::new('', $secure).Password
if ([string]::IsNullOrWhiteSpace($pass)) { Write-Host 'No password. Aborting.'; exit 1 }

$destUrl = "https://${Server}:$Port/msdeploy.axd?site=$SiteName"

$args = @(
    '-verb:sync',
    "-source:contentPath=`"$stage`"",
    "-dest:contentPath=`"$SiteName`",computerName=`"$destUrl`",userName=`"$UserName`",password=`"$pass`",authType=Basic",
    '-allowUntrusted',
    '-retryAttempts:3'
)
if ($WhatIf) { $args += '-whatif' }

Write-Host ""
Write-Host ($(if ($WhatIf) { 'PREVIEW (nothing will be written)' } else { 'Publishing...' })) -ForegroundColor Cyan

& $msdeploy @args
$code = $LASTEXITCODE

# The password only ever lived in this process; drop it and the staged copy.
$pass = $null
Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
if ($code -eq 0) {
    Write-Host 'Done. Now open https://posreporting.tryasp.net/takeaway-day and REFRESH -' -ForegroundColor Green
    Write-Host 'a clean load proves web.config landed and deep links work.' -ForegroundColor Green
} else {
    Write-Host "msdeploy exited with $code - nothing assumed published." -ForegroundColor Yellow
    Write-Host 'If it says the remote agent is unreachable, confirm WebDeploy is Enabled in the panel.' -ForegroundColor Yellow
}
exit $code
