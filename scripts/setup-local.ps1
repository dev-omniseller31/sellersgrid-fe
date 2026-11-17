$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$example = Join-Path $root "apps/api/.env.example"
$target = Join-Path $root "apps/api/.env"

if (Test-Path $target) {
  Write-Host "apps/api/.env already exists; leaving its secrets unchanged."
  exit 0
}

$jwtBytes = New-Object byte[] 48
$keyBytes = New-Object byte[] 32
$random = [Security.Cryptography.RandomNumberGenerator]::Create()
$random.GetBytes($jwtBytes)
$random.GetBytes($keyBytes)
$random.Dispose()
$jwt = [Convert]::ToBase64String($jwtBytes)
$key = [Convert]::ToBase64String($keyBytes)
$content = [IO.File]::ReadAllText($example)
$content = $content.Replace("replace-with-at-least-32-random-characters", $jwt).Replace("replace-with-32-byte-base64-key", $key)
[IO.File]::WriteAllText($target, $content, [Text.UTF8Encoding]::new($false))

if ($jwt.Length -lt 32 -or [Convert]::FromBase64String($key).Length -ne 32) { throw "Secret generation failed" }
Write-Host "Created apps/api/.env with fresh local secrets."
