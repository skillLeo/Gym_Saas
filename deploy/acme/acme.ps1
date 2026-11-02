# ACME v2 (RFC 8555) client, HTTP-01, multiple domains on one certificate.
#
# Same approach as acme.ps1 but issues a SAN certificate, because redirecting
# http://www to https://www is worse than useless if the cert does not cover
# www: the TLS handshake fails before any redirect can run.
#
# ASCII only - PowerShell 5.1 reads this file as ANSI and a stray non-ASCII
# character inside a string literal is a parse error.

param(
    [Parameter(Mandatory = $true)][string[]]$Domains,
    [Parameter(Mandatory = $true)][string]$WorkDir,
    [string]$Directory = 'https://acme-staging-v02.api.letsencrypt.org/directory',
    [Parameter(Mandatory = $true)][scriptblock]$PublishChallenge
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$openssl = 'C:\Program Files\Git\mingw64\bin\openssl.exe'
if (-not (Test-Path $openssl)) { $openssl = (Get-Command openssl).Source }

New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null
$acctKey = Join-Path $WorkDir 'account.key'
$certKey = Join-Path $WorkDir 'cert.key'

function B64Url([byte[]]$b) { [Convert]::ToBase64String($b).TrimEnd('=').Replace('+','-').Replace('/','_') }
function B64UrlText([string]$s) { B64Url ([Text.Encoding]::UTF8.GetBytes($s)) }

function OpenSslSign([string]$data, [string]$keyFile) {
    $inFile = Join-Path $WorkDir 'sign.in'; $outFile = Join-Path $WorkDir 'sign.out'
    [IO.File]::WriteAllText($inFile, $data, (New-Object Text.UTF8Encoding $false))
    & $openssl dgst -sha256 -sign $keyFile -out $outFile $inFile
    if ($LASTEXITCODE -ne 0) { throw "openssl sign failed" }
    B64Url ([IO.File]::ReadAllBytes($outFile))
}

if (-not (Test-Path $acctKey)) { & $openssl genrsa -out $acctKey 2048 2>$null }
if (-not (Test-Path $certKey)) { & $openssl genrsa -out $certKey 2048 2>$null }

$modHex = ((& $openssl rsa -in $acctKey -noout -modulus) -replace '^Modulus=','').Trim()
$modBytes = [byte[]]::new($modHex.Length / 2)
for ($i = 0; $i -lt $modBytes.Length; $i++) { $modBytes[$i] = [Convert]::ToByte($modHex.Substring($i*2,2),16) }
$jwk = [ordered]@{ e = 'AQAB'; kty = 'RSA'; n = (B64Url $modBytes) }
$thumbJson = '{"e":"' + $jwk.e + '","kty":"' + $jwk.kty + '","n":"' + $jwk.n + '"}'
$thumbprint = B64Url ([Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($thumbJson)))

$dir = Invoke-RestMethod -Uri $Directory -UseBasicParsing
$script:nonce = (Invoke-WebRequest -Uri $dir.newNonce -Method Head -UseBasicParsing).Headers['Replay-Nonce']
$script:kid = $null

function AcmePost([string]$url, $payload) {
    $protected = [ordered]@{ alg = 'RS256'; nonce = $script:nonce; url = $url }
    if ($script:kid) { $protected.kid = $script:kid } else { $protected.jwk = $jwk }
    $p64 = B64UrlText ($protected | ConvertTo-Json -Compress -Depth 10)
    $pl64 = if ($null -eq $payload) { '' } else { B64UrlText ($payload | ConvertTo-Json -Compress -Depth 10) }
    $body = [ordered]@{ protected = $p64; payload = $pl64; signature = (OpenSslSign "$p64.$pl64" $acctKey) } | ConvertTo-Json -Compress
    try {
        $resp = Invoke-WebRequest -Uri $url -Method Post -Body $body -ContentType 'application/jose+json' -UseBasicParsing
    } catch {
        $r = $_.Exception.Response
        if ($r) {
            $errBody = (New-Object IO.StreamReader($r.GetResponseStream())).ReadToEnd()
            if ($r.Headers['Replay-Nonce']) { $script:nonce = $r.Headers['Replay-Nonce'] }
            throw "ACME POST $url failed: $errBody"
        }
        throw
    }
    $script:nonce = $resp.Headers['Replay-Nonce']
    return $resp
}

Write-Host '==> account'
$acct = AcmePost $dir.newAccount ([ordered]@{ termsOfServiceAgreed = $true })
$script:kid = $acct.Headers['Location']

Write-Host "==> order for: $($Domains -join ', ')"
$ids = @(); foreach ($d in $Domains) { $ids += @{ type = 'dns'; value = $d } }
$orderResp = AcmePost $dir.newOrder ([ordered]@{ identifiers = $ids })
$orderUrl = $orderResp.Headers['Location']
$order = $orderResp.Content | ConvertFrom-Json

# Publish every challenge before triggering any of them, so a slow upload
# cannot let the CA validate one name while another is still unserved.
$chals = @()
foreach ($authUrl in $order.authorizations) {
    $authz = (AcmePost $authUrl $null).Content | ConvertFrom-Json
    $name = $authz.identifier.value
    if ($authz.status -eq 'valid') { Write-Host "    $name already valid"; continue }
    $c = $authz.challenges | Where-Object { $_.type -eq 'http-01' }
    if (-not $c) { throw "no http-01 challenge for $name" }
    $keyAuth = "$($c.token).$thumbprint"
    Write-Host "    publishing challenge for $name"
    & $PublishChallenge $c.token $keyAuth $name
    $chals += [pscustomobject]@{ Name = $name; Url = $c.url; AuthUrl = $authUrl }
}

foreach ($c in $chals) { AcmePost $c.Url ([ordered]@{}) | Out-Null }

foreach ($c in $chals) {
    $deadline = (Get-Date).AddMinutes(3); $status = 'pending'
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 3
        $a = (AcmePost $c.AuthUrl $null).Content | ConvertFrom-Json
        $status = $a.status
        if ($status -ne 'pending') { break }
    }
    if ($status -ne 'valid') {
        $d = ($a.challenges | Where-Object { $_.type -eq 'http-01' }).error | ConvertTo-Json -Compress
        throw "authorization failed for $($c.Name) (status=$status): $d"
    }
    Write-Host "    $($c.Name) valid"
}

Write-Host '==> CSR with subjectAltName'
$csrPath = Join-Path $WorkDir 'cert.csr'
$san = ($Domains | ForEach-Object { "DNS:$_" }) -join ','
& $openssl req -new -key $certKey -out $csrPath -subj "/CN=$($Domains[0])" -addext "subjectAltName=$san" -sha256 2>$null
if ($LASTEXITCODE -ne 0) { throw 'CSR generation failed' }
$csrDer = Join-Path $WorkDir 'cert.csr.der'
& $openssl req -in $csrPath -outform DER -out $csrDer
$csr64 = B64Url ([IO.File]::ReadAllBytes($csrDer))

AcmePost $order.finalize ([ordered]@{ csr = $csr64 }) | Out-Null

$deadline = (Get-Date).AddMinutes(3)
while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 3
    $o = (AcmePost $orderUrl $null).Content | ConvertFrom-Json
    if ($o.status -eq 'valid') { break }
    if ($o.status -eq 'invalid') { throw "order invalid: $($o | ConvertTo-Json -Compress)" }
}
if ($o.status -ne 'valid') { throw "order not valid in time (status=$($o.status))" }

# The certificate body comes back as bytes, not text; writing the response
# object straight out produces a file full of decimal numbers instead of PEM.
$raw = (AcmePost $o.certificate $null).Content
if ($raw -is [byte[]]) { $pem = [Text.Encoding]::UTF8.GetString($raw) } else { $pem = [string]$raw }
[IO.File]::WriteAllText((Join-Path $WorkDir 'fullchain.pem'), $pem)
Write-Host "==> saved fullchain.pem ($($pem.Length) chars)"
Write-Host 'DONE'
