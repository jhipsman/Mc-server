@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

REM ============================================================================
REM  World backup script
REM   - Copies world, world_nether and world_the_end into
REM     backups\world-YYYY-MM-DD_HH-MM-SS\
REM   - Deletes backup folders older than KEEP_DAYS days
REM   - If mcrcon.exe is next to this script and RCON is enabled, it pauses
REM     auto-saving during the copy so the backup is consistent while the
REM     server is running (https://github.com/Tiiffi/mcrcon/releases)
REM
REM  Schedule it with Windows Task Scheduler (see README.md).
REM ============================================================================

set "KEEP_DAYS=7"
set "BACKUP_DIR=%~dp0backups"
set "WORLDS=world world_nether world_the_end"

REM Locale-independent timestamp (wmic is deprecated on Windows 11).
for /f "delims=" %%T in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH-mm-ss"') do set "STAMP=%%T"
if "%STAMP%"=="" (
    echo [ERROR] Could not generate a timestamp.
    exit /b 1
)

set "DEST=%BACKUP_DIR%\world-%STAMP%"

REM ---- Optional: tell a running server to flush and pause saving -------------
set "USE_RCON=0"
if exist "mcrcon.exe" (
    for /f "usebackq tokens=1,* delims==" %%A in ("server.properties") do (
        if /i "%%A"=="rcon.password" set "RCON_PASS=%%B"
        if /i "%%A"=="rcon.port" set "RCON_PORT=%%B"
        if /i "%%A"=="enable-rcon" set "RCON_ON=%%B"
    )
    if /i "!RCON_ON!"=="true" if not "!RCON_PASS!"=="" (
        mcrcon.exe -H 127.0.0.1 -P !RCON_PORT! -p "!RCON_PASS!" "say Backup starting..." "save-off" "save-all flush" >nul 2>&1
        if not errorlevel 1 (
            set "USE_RCON=1"
            echo Server auto-save paused for backup.
            REM give the server a moment to finish writing chunks
            timeout /t 5 /nobreak >nul
        ) else (
            echo Server not reachable over RCON - assuming it is stopped.
        )
    )
)

echo Backing up to "%DEST%"
set "COPIED=0"
for %%W in (%WORLDS%) do (
    if exist "%%W\" (
        REM robocopy exit codes 0-7 are success; 8+ are failures.
        robocopy "%%W" "%DEST%\%%W" /E /R:2 /W:2 /NFL /NDL /NJH /NJS /NP /XF session.lock >nul
        if errorlevel 8 (
            echo [ERROR] Failed to copy %%W
        ) else (
            echo   copied %%W
            set "COPIED=1"
        )
    )
)

if "%USE_RCON%"=="1" (
    mcrcon.exe -H 127.0.0.1 -P !RCON_PORT! -p "!RCON_PASS!" "save-on" "say Backup complete." >nul 2>&1
    echo Server auto-save resumed.
)

if "%COPIED%"=="0" (
    echo [WARN] No world folders found - nothing was backed up.
    if exist "%DEST%" rmdir /s /q "%DEST%"
)

REM ---- Delete backups older than KEEP_DAYS ------------------------------------
echo Removing backups older than %KEEP_DAYS% days...
if exist "%BACKUP_DIR%" (
    forfiles /p "%BACKUP_DIR%" /m "world-*" /d -%KEEP_DAYS% /c "cmd /c if @isdir==TRUE (echo   deleting @file & rmdir /s /q @path)" 2>nul
)

echo Done.
if "%COPIED%"=="0" exit /b 1
exit /b 0
