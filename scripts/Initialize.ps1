param([string]$DataRoot = 'D:\HDC-Data\HDC-Tote-Tracker-data')
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
if (Test-Path -LiteralPath '.env') {
    Write-Output '.env already exists. Kept the existing credentials and storage paths.'
    exit 0
}
$root = [IO.Path]::GetFullPath($DataRoot)
New-Item -ItemType Directory -Force -Path (Join-Path $root 'postgres-app'), (Join-Path $root 'postgres-images') | Out-Null
function New-DatabasePassword {
    $buffer = New-Object byte[] 32
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($buffer) } finally { $generator.Dispose() }
    return ([BitConverter]::ToString($buffer)).Replace('-', '').ToLowerInvariant()
}
$appPassword = New-DatabasePassword
$imagePassword = New-DatabasePassword
$forwardRoot = $root.Replace('\', '/')
$content = "APP_DB_PASSWORD=$appPassword`nIMAGE_DB_PASSWORD=$imagePassword`nCOOKIE_SECURE=false`nAPP_DATA_PATH=$forwardRoot/postgres-app`nIMAGE_DATA_PATH=$forwardRoot/postgres-images`n"
$utf8 = New-Object Text.UTF8Encoding($false)
[IO.File]::WriteAllText((Join-Path (Get-Location) '.env'), $content, $utf8)
Write-Output 'Created .env with random database passwords and prepared the storage directories.'
Write-Output 'Run: docker compose up --build -d'
