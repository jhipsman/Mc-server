@echo off
setlocal EnableExtensions
cd /d "%~dp0"

REM ============================================================================
REM  Downloads the latest versions of:
REM    EssentialsX, LuckPerms, GriefPrevention, Vault, CoreProtect,
REM    WorldGuard, WorldEdit
REM  into the plugins\ folder. Also downloads Paper itself if no paper-*.jar
REM  is present yet. Re-run any time to update; old jars are moved to
REM  plugins\.old-jars\.
REM
REM  Optional arguments (passed to scripts\download-plugins.ps1):
REM    -McVersion 1.21.8   only fetch builds for this Minecraft version
REM    -UpdatePaper        download the latest Paper build even if one exists
REM ============================================================================

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\download-plugins.ps1" -ServerDir "%~dp0." %*
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" echo Some downloads failed - see the messages above.
pause
exit /b %RC%
