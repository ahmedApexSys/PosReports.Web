@echo off
REM === Double-click this to publish the reports site (posreporting.tryasp.net) ===
REM It will ask you for: FTP host, username, password (copy them from your
REM MonsterASP.NET / tryasp.net control panel -> site73506 -> FTP / Connection Info).
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0deploy-reports-ftp.ps1"
echo.
pause
