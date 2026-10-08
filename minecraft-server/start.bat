@echo off
setlocal EnableExtensions
title Minecraft Server (PaperMC)
cd /d "%~dp0"

REM ============================================================================
REM  PaperMC start script with Aikar's optimized G1GC flags
REM  https://docs.papermc.io/paper/aikars-flags
REM
REM  RAM: Aikar recommends setting MIN and MAX to the SAME value so the heap is
REM  reserved up front. 6G is a good default for a 4-6GB budget; drop both to
REM  4G or 5G if the machine has 8GB of RAM or less. Always leave 2-3GB free
REM  for Windows itself.
REM
REM  Usage:  start.bat            (pauses after the server stops)
REM          start.bat --nopause  (used by the watchdog in mc-admin-dashboard)
REM ============================================================================

set "MIN_RAM=6G"
set "MAX_RAM=6G"

REM Leave blank to auto-detect the newest paper-*.jar in this folder.
set "SERVER_JAR="
set "EXIT_CODE=1"

REM ---------------------------------------------------------------------------

where java >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Java was not found on PATH.
    echo         Install Java 21 ^(e.g. Eclipse Temurin 21^) from https://adoptium.net/
    goto :end
)

if "%SERVER_JAR%"=="" (
    for /f "delims=" %%F in ('dir /b /o:d "paper-*.jar" 2^>nul') do set "SERVER_JAR=%%F"
)
if "%SERVER_JAR%"=="" (
    echo [ERROR] No paper-*.jar found in %CD%
    echo         Run setup-plugins.bat ^(it downloads Paper too^) or download it
    echo         from https://papermc.io/downloads/paper
    goto :end
)

if not exist "eula.txt" (
    echo eula=false> eula.txt
)
findstr /i /c:"eula=true" eula.txt >nul 2>&1
if errorlevel 1 (
    echo [ERROR] You must accept the Minecraft EULA first.
    echo         Read https://aka.ms/MinecraftEULA then open eula.txt and set eula=true
    goto :end
)

echo Starting %SERVER_JAR% with %MIN_RAM% / %MAX_RAM% RAM...

REM Note: Aikar's original -XX:G1RSetUpdatingPauseIntervalMillis flag is omitted
REM on purpose - it was removed from Java 21 and makes the JVM refuse to start.
java -Xms%MIN_RAM% -Xmx%MAX_RAM% ^
 -XX:+UseG1GC ^
 -XX:+ParallelRefProcEnabled ^
 -XX:MaxGCPauseMillis=200 ^
 -XX:+UnlockExperimentalVMOptions ^
 -XX:+DisableExplicitGC ^
 -XX:+AlwaysPreTouch ^
 -XX:G1NewSizePercent=30 ^
 -XX:G1MaxNewSizePercent=40 ^
 -XX:G1HeapRegionSize=8M ^
 -XX:G1ReservePercent=20 ^
 -XX:G1HeapWastePercent=5 ^
 -XX:G1MixedGCCountTarget=4 ^
 -XX:InitiatingHeapOccupancyPercent=15 ^
 -XX:G1MixedGCLiveThresholdPercent=90 ^
 -XX:SurvivorRatio=32 ^
 -XX:+PerfDisableSharedMem ^
 -XX:MaxTenuringThreshold=1 ^
 -Dusing.aikars.flags=https://mcflags.emc.gs ^
 -Daikars.new.flags=true ^
 -jar "%SERVER_JAR%" --nogui

set "EXIT_CODE=%ERRORLEVEL%"
echo.
echo Server stopped (exit code %EXIT_CODE%).

:end
if /i not "%~1"=="--nopause" pause
exit /b %EXIT_CODE%
