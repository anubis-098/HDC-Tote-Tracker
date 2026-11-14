param([string]$OutputDirectory = 'D:\HDC-Data\HDC-Tote-Tracker-data\backups')
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
function Invoke-Docker([string[]]$DockerArguments) {
    & docker @DockerArguments
    if ($LASTEXITCODE -ne 0) { throw "Docker operation failed (exit $LASTEXITCODE)" }
}
$stamp = Get-Date -Format 'yyyyMMdd-HHmmssfff'
$destination = Join-Path ([IO.Path]::GetFullPath($OutputDirectory)) $stamp
New-Item -ItemType Directory -Path $destination -ErrorAction Stop | Out-Null
$running = @(& docker compose ps --services --status running)
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect Compose services' }
$resumeServices = @('api', 'frontend' | Where-Object { $running -contains $_ })
try {
    if ($resumeServices.Count -gt 0) { Invoke-Docker -DockerArguments (@('compose', 'stop') + $resumeServices) }
    Invoke-Docker -DockerArguments @('compose', 'exec', '-T', 'postgres-app', 'pg_dump', '-U', 'tote', '-d', 'tote_app', '-Fc', '-f', '/tmp/tote-app.dump')
    Invoke-Docker -DockerArguments @('compose', 'cp', 'postgres-app:/tmp/tote-app.dump', (Join-Path $destination 'tote-app.dump'))
    Invoke-Docker -DockerArguments @('compose', 'exec', '-T', 'postgres-images', 'pg_dump', '-U', 'images', '-d', 'tote_images', '-Fc', '-f', '/tmp/tote-images.dump')
    Invoke-Docker -DockerArguments @('compose', 'cp', 'postgres-images:/tmp/tote-images.dump', (Join-Path $destination 'tote-images.dump'))
    $appCounts = & docker compose exec -T postgres-app psql -U tote -d tote_app -At -c "SELECT json_build_object('totes',(SELECT count(*) FROM totes),'events',(SELECT count(*) FROM tote_events),'stores',(SELECT count(*) FROM stores),'workers',(SELECT count(*) FROM workers))"
    if ($LASTEXITCODE -ne 0) { throw 'Cannot verify app backup counts' }
    $imageCounts = & docker compose exec -T postgres-images psql -U images -d tote_images -At -c "SELECT json_build_object('photos',count(*),'bytes',COALESCE(sum(byte_size),0)) FROM photos"
    if ($LASTEXITCODE -ne 0) { throw 'Cannot verify image backup counts' }
    $manifest = @{
        created_utc = (Get-Date).ToUniversalTime().ToString('o')
        app = ($appCounts | ConvertFrom-Json)
        images = ($imageCounts | ConvertFrom-Json)
        files = @(Get-ChildItem -LiteralPath $destination -Filter '*.dump' | ForEach-Object { @{ name = $_.Name; bytes = $_.Length; sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash } })
    }
    $manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $destination 'manifest.json') -Encoding UTF8
    Write-Output "Verified backup saved: $destination"
} finally {
    if ($resumeServices.Count -gt 0) { Invoke-Docker -DockerArguments (@('compose', 'up', '-d', '--no-deps') + $resumeServices) }
}
