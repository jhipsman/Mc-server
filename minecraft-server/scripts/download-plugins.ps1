<#
.SYNOPSIS
  Downloads the latest Paper build (if missing) and the core plugin set.

.DESCRIPTION
  Sources (official distribution channels for each project):
    EssentialsX      GitHub releases   EssentialsX/Essentials
    LuckPerms        metadata.luckperms.net (official download API)
    GriefPrevention  GitHub releases   GriefPrevention/GriefPrevention
    Vault            GitHub releases   MilkBowl/Vault
    CoreProtect      Modrinth          coreprotect      (GitHub fallback)
    WorldEdit        Modrinth          worldedit
    WorldGuard       Modrinth          worldguard
    Paper            fill.papermc.io v3 API (api.papermc.io v2 fallback)
#>
param(
    [string]$ServerDir = (Split-Path -Parent $PSScriptRoot),
    [string]$McVersion = "",
    [switch]$UpdatePaper
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"   # makes Invoke-WebRequest much faster
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$UserAgent = "minecraft-server-setup/1.0 (+https://github.com/jhipsman/Mc-server)"
$Headers = @{ "User-Agent" = $UserAgent }

$ServerDir  = (Resolve-Path $ServerDir).Path
$PluginsDir = Join-Path $ServerDir "plugins"
$OldDir     = Join-Path $PluginsDir ".old-jars"
New-Item -ItemType Directory -Force -Path $PluginsDir | Out-Null

$failures = New-Object System.Collections.Generic.List[string]

function Get-Json([string]$Url) {
    return Invoke-RestMethod -Uri $Url -Headers $Headers -TimeoutSec 60
}

function Save-File([string]$Url, [string]$Destination) {
    $tmp = "$Destination.part"
    Invoke-WebRequest -Uri $Url -Headers $Headers -OutFile $tmp -TimeoutSec 300 -UseBasicParsing
    Move-Item -Force $tmp $Destination
}

# Moves previous versions of a plugin out of plugins\ so Paper does not load two copies.
function Remove-OldJars([string]$Pattern, [string]$KeepName) {
    Get-ChildItem -Path $PluginsDir -Filter $Pattern -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -ne $KeepName } |
        ForEach-Object {
            New-Item -ItemType Directory -Force -Path $OldDir | Out-Null
            Move-Item -Force $_.FullName (Join-Path $OldDir $_.Name)
            Write-Host "    moved old $($_.Name) to plugins\.old-jars"
        }
}

function Install-Jar([string]$Name, [string]$Url, [string]$FileName, [string]$OldPattern) {
    $dest = Join-Path $PluginsDir $FileName
    if (Test-Path $dest) {
        Write-Host "  [=] $Name is up to date ($FileName)" -ForegroundColor DarkGray
    } else {
        Write-Host "  [+] $Name -> $FileName"
        Save-File $Url $dest
    }
    Remove-OldJars $OldPattern $FileName
}

# ---------- Sources ----------------------------------------------------------

function Get-GitHubAsset([string]$Repo, [string]$AssetRegex) {
    $release = Get-Json "https://api.github.com/repos/$Repo/releases/latest"
    $asset = $release.assets | Where-Object { $_.name -match $AssetRegex } | Select-Object -First 1
    if (-not $asset) { throw "No asset matching '$AssetRegex' in $Repo $($release.tag_name)" }
    $file = $asset.name
    # Some projects ship an unversioned file name (Vault.jar); add the tag so updates are detectable.
    if ($file -notmatch '\d') { $file = $file -replace '\.jar$', "-$($release.tag_name.TrimStart('v')).jar" }
    return @{ Url = $asset.browser_download_url; File = $file }
}

function Get-ModrinthFile([string]$Slug) {
    $loaders = [uri]::EscapeDataString('["paper","spigot","bukkit"]')
    $url = "https://api.modrinth.com/v2/project/$Slug/version?loaders=$loaders"
    if ($McVersion) { $url += "&game_versions=" + [uri]::EscapeDataString("[`"$McVersion`"]") }
    $versions = @(Get-Json $url)
    $pick = $versions | Where-Object { $_.version_type -eq "release" } | Select-Object -First 1
    if (-not $pick) { $pick = $versions | Select-Object -First 1 }
    if (-not $pick) { throw "Modrinth has no Paper/Bukkit build of '$Slug'$(if ($McVersion) { " for $McVersion" })" }
    $file = $pick.files | Where-Object { $_.primary } | Select-Object -First 1
    if (-not $file) { $file = $pick.files | Select-Object -First 1 }
    return @{ Url = $file.url; File = $file.filename }
}

function Get-LuckPerms {
    $meta = Get-Json "https://metadata.luckperms.net/data/all"
    $url = $meta.downloads.bukkit
    if (-not $url) { throw "LuckPerms metadata did not contain a Bukkit download" }
    return @{ Url = $url; File = [IO.Path]::GetFileName(([uri]$url).AbsolutePath) }
}

# ---------- Paper ------------------------------------------------------------

function Install-Paper {
    $existing = Get-ChildItem -Path $ServerDir -Filter "paper-*.jar" -File -ErrorAction SilentlyContinue
    if ($existing -and -not $UpdatePaper) {
        Write-Host "  [=] Paper already present ($($existing[-1].Name)); use -UpdatePaper to fetch the latest build" -ForegroundColor DarkGray
        return
    }

    $url = $null; $file = $null
    try {
        # Fill v3 API (current)
        $project = Get-Json "https://fill.papermc.io/v3/projects/paper"
        $version = $McVersion
        if (-not $version) {
            # versions is a map of version-group -> [versions]; pick the highest stable one
            $all = @()
            foreach ($group in $project.versions.PSObject.Properties) { $all += $group.Value }
            $version = $all | Where-Object { $_ -match '^\d+(\.\d+)+$' } |
                Sort-Object { [version]$_ } -Descending | Select-Object -First 1
        }
        $build = Get-Json "https://fill.papermc.io/v3/projects/paper/versions/$version/builds/latest"
        $dl = $build.downloads.'server:default'
        $url = $dl.url; $file = $dl.name
    } catch {
        Write-Host "    Fill API failed ($($_.Exception.Message)); trying legacy API" -ForegroundColor Yellow
        $project = Get-Json "https://api.papermc.io/v2/projects/paper"
        $version = if ($McVersion) { $McVersion } else { $project.versions[-1] }
        $builds = Get-Json "https://api.papermc.io/v2/projects/paper/versions/$version/builds"
        $latest = $builds.builds | Where-Object { $_.channel -eq "default" } | Select-Object -Last 1
        if (-not $latest) { $latest = $builds.builds[-1] }
        $file = $latest.downloads.application.name
        $url = "https://api.papermc.io/v2/projects/paper/versions/$version/builds/$($latest.build)/downloads/$file"
    }

    $dest = Join-Path $ServerDir $file
    if (Test-Path $dest) {
        Write-Host "  [=] Paper is up to date ($file)" -ForegroundColor DarkGray
    } else {
        Write-Host "  [+] Paper -> $file"
        Save-File $url $dest
    }
    # keep only the newest Paper jar
    Get-ChildItem -Path $ServerDir -Filter "paper-*.jar" -File | Where-Object { $_.Name -ne $file } |
        ForEach-Object { Remove-Item -Force $_.FullName; Write-Host "    removed old $($_.Name)" }
}

# ---------- Run --------------------------------------------------------------

$plugins = @(
    @{ Name = "EssentialsX";     Old = "EssentialsX-*.jar";     Get = { Get-GitHubAsset "EssentialsX/Essentials" '^EssentialsX-[\d\.]+\.jar$' } },
    @{ Name = "LuckPerms";       Old = "LuckPerms-Bukkit-*.jar"; Get = { Get-LuckPerms } },
    @{ Name = "GriefPrevention"; Old = "GriefPrevention*.jar";  Get = { Get-GitHubAsset "GriefPrevention/GriefPrevention" '^GriefPrevention.*\.jar$' } },
    @{ Name = "Vault";           Old = "Vault*.jar";            Get = { Get-GitHubAsset "MilkBowl/Vault" '^Vault.*\.jar$' } },
    @{ Name = "CoreProtect";     Old = "CoreProtect*.jar";      Get = {
        try { Get-ModrinthFile "coreprotect" }
        catch { Get-GitHubAsset "PlayPro/CoreProtect" '^CoreProtect.*\.jar$' } } },
    @{ Name = "WorldEdit";       Old = "worldedit-bukkit-*.jar"; Get = { Get-ModrinthFile "worldedit" } },
    @{ Name = "WorldGuard";      Old = "worldguard-bukkit-*.jar"; Get = { Get-ModrinthFile "worldguard" } }
)

Write-Host ""
Write-Host "Server folder: $ServerDir"
if ($McVersion) { Write-Host "Minecraft version filter: $McVersion" }
Write-Host ""

Write-Host "Paper:"
try { Install-Paper } catch {
    Write-Host "  [!] Paper download failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "      Download it manually from https://papermc.io/downloads/paper"
    $failures.Add("Paper")
}

Write-Host ""
Write-Host "Plugins:"
foreach ($p in $plugins) {
    try {
        $info = & $p.Get
        Install-Jar $p.Name $info.Url $info.File $p.Old
    } catch {
        Write-Host "  [!] $($p.Name) failed: $($_.Exception.Message)" -ForegroundColor Red
        $failures.Add($p.Name)
    }
}

Write-Host ""
if ($failures.Count -gt 0) {
    Write-Host "Failed: $($failures -join ', ')" -ForegroundColor Red
    Write-Host "Download those manually (links in README.md) and drop them into plugins\"
    exit 1
}
Write-Host "All downloads complete." -ForegroundColor Green
Write-Host "Tip: build SurvivalPlus (see SurvivalPlus\README.md) and copy its jar into plugins\ too."
exit 0
