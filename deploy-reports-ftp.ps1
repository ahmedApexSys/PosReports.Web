# ============================================================================
#  Deploy PosReports.Web (the live reports site) via FTP.
#  Site: posreporting.tryasp.net  (host site73506 on MonsterASP.NET / tryasp.net)
#
#  How to run:
#    1) Open PowerShell in the project folder (D:\Apex work\PosReports.Web)
#    2) Run:   powershell -ExecutionPolicy Bypass -File .\deploy-reports-ftp.ps1
#    3) It asks for: FTP host + username + password  ->  copy them from the
#       hosting panel (MonsterASP.NET -> Websites -> site73506 -> FTP access).
#
#  No password is stored in this file. You type it at run time and it is gone
#  when the script ends.
#
#  ASCII ONLY, ON PURPOSE. Windows PowerShell 5.1 reads a .ps1 with no byte-order
#  mark as ANSI, so any non-ASCII character (Arabic text, a long dash) is decoded
#  into bytes that break string parsing - which is exactly how this script once
#  died with "The string is missing the terminator". Keeping it to plain ASCII
#  means the file cannot be broken by whatever editor or tool touches it next.
# ============================================================================

$ErrorActionPreference = 'Stop'

# Angular emits the site into dist\pos-reports-web\browser and leaves build metadata
# (3rdpartylicenses.txt, prerendered-routes.json) in the parent. Uploading the parent would put
# index.html at /wwwroot/browser/index.html - a site with no home page - and litter the web root
# with files that are not part of it. Take the browser folder when it exists, and keep working
# with the older flat layout when it does not.
$distRoot  = Join-Path $PSScriptRoot 'dist\pos-reports-web'
$localRoot = Join-Path $distRoot 'browser'
if (-not (Test-Path $localRoot)) { $localRoot = $distRoot }

if (-not (Test-Path (Join-Path $localRoot 'index.html'))) {
    Write-Host "No index.html in $localRoot - build first:  npm run build" -ForegroundColor Yellow
    exit 1
}

# ---- credentials (you type them now; nothing is saved) ---------------------
$ftpHost = Read-Host 'FTP host (e.g. ftp://site73506.siteasp.net)'
if ([string]::IsNullOrWhiteSpace($ftpHost)) { Write-Host 'No host. Aborting.'; exit 1 }
if ($ftpHost -notmatch '^ftp://') { $ftpHost = 'ftp://' + $ftpHost }
$ftpHost = $ftpHost.TrimEnd('/')

$user   = Read-Host 'FTP username (e.g. site73506)'
$secure = Read-Host 'FTP password' -AsSecureString
$pass   = [System.Net.NetworkCredential]::new('', $secure).Password
$cred   = New-Object System.Net.NetworkCredential($user, $pass)

$remoteBase = Read-Host 'Remote folder (press Enter for /wwwroot ; if the site does not update, re-run and type / instead)'
if ([string]::IsNullOrWhiteSpace($remoteBase)) { $remoteBase = '/wwwroot' }
$remoteBase = '/' + $remoteBase.Trim('/')
if ($remoteBase -eq '/') { $remoteBase = '' }

function Ensure-FtpDir($dirUrl) {
    try {
        $req = [System.Net.FtpWebRequest]::Create($dirUrl)
        $req.Method = [System.Net.WebRequestMethods+Ftp]::MakeDirectory
        $req.Credentials = $cred
        ($req.GetResponse()).Close()
    } catch { }   # already exists -> ignore
}

function Upload-File($localPath, $remoteUrl) {
    try {
        $req = [System.Net.FtpWebRequest]::Create($remoteUrl)
        $req.Method = [System.Net.WebRequestMethods+Ftp]::UploadFile
        $req.Credentials = $cred
        $req.UseBinary = $true
        $req.UsePassive = $true
        $bytes = [System.IO.File]::ReadAllBytes($localPath)
        $req.ContentLength = $bytes.Length
        $s = $req.GetRequestStream(); $s.Write($bytes, 0, $bytes.Length); $s.Close()
        ($req.GetResponse()).Close()
        return $true
    } catch {
        Write-Host "FAIL: $remoteUrl - $_" -ForegroundColor Red
        return $false
    }
}

# web.config lives at the repo root (Angular never copies it), yet it is what makes deep links
# work: without it IIS answers a refresh on /takeaway-day with a 404, because it looks for a folder
# by that name. Ship it with the build instead of relying on a copy left by an earlier upload.
$webConfig = Join-Path $PSScriptRoot 'web.config'
if ((Test-Path $webConfig) -and -not (Test-Path (Join-Path $localRoot 'web.config'))) {
    Copy-Item $webConfig (Join-Path $localRoot 'web.config') -Force
    Write-Host 'web.config added to the upload set (SPA deep links).' -ForegroundColor DarkCyan
}

$files = @(Get-ChildItem $localRoot -Recurse -File)
$total = $files.Count; $done = 0; $fail = 0
Write-Host ""
Write-Host "Uploading $total files from $localRoot" -ForegroundColor Cyan
Write-Host "                        to $ftpHost$remoteBase" -ForegroundColor Cyan

foreach ($f in $files) {
    $rel = $f.FullName.Substring($localRoot.Length).Replace('\', '/')
    $remoteUrl = $ftpHost + $remoteBase + $rel

    # make sure every parent folder exists on the server
    $parts = ($remoteBase + $rel).Split('/') | Where-Object { $_ -ne '' }
    $cur = $ftpHost
    for ($i = 0; $i -lt $parts.Count - 1; $i++) { $cur += '/' + $parts[$i]; Ensure-FtpDir $cur }

    if (Upload-File $f.FullName $remoteUrl) { $done++ } else { $fail++ }
    if ($done % 20 -eq 0 -and $done -gt 0) { Write-Host "  $done/$total..." }
}

Write-Host ""
Write-Host "Done: $done uploaded, $fail failed." -ForegroundColor Green
if ($fail -gt 0) { Write-Host "Some files failed - check the host/folder and re-run." -ForegroundColor Yellow }
