# ============================================================================
#  Deploy PosReports.Web (the live reports site) via FTP.
#  الموقع: posreporting.tryasp.net  (host site73506 على MonsterASP.NET / tryasp.net)
#
#  طريقة التشغيل:
#    1) افتح PowerShell في فولدر المشروع (D:\Apex work\PosReports.Web)
#    2) شغّل:   powershell -ExecutionPolicy Bypass -File .\deploy-reports-ftp.ps1
#    3) هيسألك على: FTP host + username + password  ->  انسخهم من لوحة تحكم
#       الاستضافة (MonsterASP.NET -> Websites -> site73506 -> FTP / Connection Info).
#
#  مفيش أي باسورد متخزن في الملف ده. إنت بتكتبه وقت التشغيل وهو بيتمسح بعد كده.
# ============================================================================

$ErrorActionPreference = 'Stop'

# Angular now emits the site into dist\pos-reports-web\browser and leaves build metadata
# (3rdpartylicenses.txt, prerendered-routes.json) in the parent. Uploading the parent would put
# index.html at /wwwroot/browser/index.html — a site with no home page — and litter the root with
# files that are not part of it. Take the browser folder when it exists, and keep working with the
# older flat layout if it does not.
$distRoot  = Join-Path $PSScriptRoot 'dist\pos-reports-web'
$localRoot = Join-Path $distRoot 'browser'
if (-not (Test-Path $localRoot)) { $localRoot = $distRoot }

if (-not (Test-Path (Join-Path $localRoot 'index.html'))) {
    Write-Host "No index.html in $localRoot — build first:  npm run build" -ForegroundColor Yellow
    exit 1
}

# ---- credentials (you type them now; nothing is saved) ---------------------
$ftpHost = Read-Host 'FTP host (e.g. ftp://posreporting.tryasp.net  OR  ftp://<server-ip from panel>)'
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

$files = @(Get-ChildItem $localRoot -Recurse -File)

# web.config lives at the repo root (Angular does not copy it), yet it is what makes deep links
# work: without it IIS answers a refresh on /takeaway-day with a 404, because it looks for a folder
# of that name. Ship it alongside the build rather than relying on a copy left by an older deploy.
$webConfig = Join-Path $PSScriptRoot 'web.config'
if ((Test-Path $webConfig) -and -not (Test-Path (Join-Path $localRoot 'web.config'))) {
    Copy-Item $webConfig (Join-Path $localRoot 'web.config') -Force
    $files = @(Get-ChildItem $localRoot -Recurse -File)
    Write-Host "web.config added to the upload set (SPA deep links)." -ForegroundColor DarkCyan
}

$total = $files.Count; $done = 0; $fail = 0
Write-Host ""
Write-Host "Uploading $total files to  $ftpHost$remoteBase  ..." -ForegroundColor Cyan

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
