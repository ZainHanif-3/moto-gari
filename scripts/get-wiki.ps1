$ErrorActionPreference = 'Continue'
$ProgressPreference   = 'SilentlyContinue'
$ua                   = 'MotoGariBuild/1.0 (portfolio demo; contact zainhanif3@gmail.com)'
$prodDir              = 'F:\websites\moto-gari\assets\products'
$candDir              = 'F:\websites\moto-gari\assets\_wiki'
New-Item -ItemType Directory -Force -Path $prodDir, $candDir | Out-Null
$log                  = Join-Path $env:TEMP 'mg-wiki-log.txt'
"" | Set-Content -Path $log -Encoding UTF8

function Log([string]$m) { Add-Content -Path $log -Value $m -Encoding UTF8; Write-Host $m }

function Test-Magic([byte[]]$b) {
  if ($b.Length -lt 4) { return $null }
  if ($b[0] -eq 0xFF -and $b[1] -eq 0xD8 -and $b[2] -eq 0xFF) { return 'jpg' }
  if ($b[0] -eq 0x89 -and $b[1] -eq 0x50 -and $b[2] -eq 0x4E -and $b[3] -eq 0x47) { return 'png' }
  if ($b[0] -eq 0x3C) { return 'html' }
  return 'unknown'
}

function Get-WikiImage([string]$title) {
  $q = [uri]::EscapeDataString($title)
  $u = "https://en.wikipedia.org/w/api.php?action=query&titles=$q&prop=pageimages&pithumbsize=1400&format=json&redirects=1"
  try { $r = Invoke-RestMethod -Uri $u -UserAgent $ua -TimeoutSec 30 } catch { Log "   wiki api fail $title"; return $null }
  $pg = $r.query.pages.PSObject.Properties.Value | Select-Object -First 1
  if ($pg -and $pg.thumbnail -and $pg.thumbnail.source) {
    return [pscustomobject]@{ url = $pg.thumbnail.source; title = "wikipedia: $($pg.title)" }
  }
  return $null
}

function Get-CommonsSearch([string]$query, [int]$limit = 8) {
  $q = [uri]::EscapeDataString($query)
  $u = "https://api.wikimedia.org/core/v1/commons/search/page?q=$q&limit=$limit"
  try { $r = Invoke-RestMethod -Uri $u -UserAgent $ua -TimeoutSec 30 } catch { Log "   commons search fail '$query'"; return @() }
  $out = @()
  foreach ($p in $r.pages) {
    if ($p.title -notmatch '\.(jpg|jpeg|png)$') { continue }
    $ft = [uri]::EscapeDataString($p.title)
    try { $f = Invoke-RestMethod -Uri "https://api.wikimedia.org/core/v1/commons/file/$ft" -UserAgent $ua -TimeoutSec 30 }
    catch { continue }
    $src = $null
    if ($f.preferred -and $f.preferred.url) { $src = $f.preferred.url }
    elseif ($f.original -and $f.original.url) { $src = $f.original.url }
    if ($src) { $out += [pscustomobject]@{ url = ($src -split '\?')[0]; title = $p.title } }
  }
  return $out
}

function Get-AllCandidates([string[]]$wikiTitles, [string[]]$searches) {
  $list = @()
  foreach ($t in $wikiTitles) {
    $w = Get-WikiImage $t
    if ($w) { $list += $w }
  }
  foreach ($s in $searches) {
    foreach ($c in (Get-CommonsSearch $s)) { $list += $c }
  }
  $seen = @{}
  $uniq = @()
  foreach ($c in $list) {
    if (-not $seen[$c.url]) { $seen[$c.url] = $true; $uniq += $c }
  }
  return $uniq
}

function Save-Candidates([string]$slot, [string[]]$wikiTitles, [string[]]$searches) {
  $dir = Join-Path $candDir $slot
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $meta = @()
  $cands = Get-AllCandidates $wikiTitles $searches
  Log "== $slot  candidates=$($cands.Count)"
  $i = 0
  foreach ($c in $cands) {
    if ($i -ge 8) { break }
    $i++
    $t = Join-Path $env:TEMP 'wk.bin'
    try { Invoke-WebRequest -Uri $c.url -OutFile $t -UserAgent $ua -TimeoutSec 45 -MaximumRedirection 6 }
    catch { Log "   [$i] fail $($c.url)"; continue }
    $b = [IO.File]::ReadAllBytes($t)
    $k = Test-Magic $b
    if (($k -eq 'jpg' -or $k -eq 'png') -and $b.Length -gt 8192) {
      $name = 'c{0:d2}.{1}' -f $i, $k
      [IO.File]::WriteAllBytes((Join-Path $dir $name), $b)
      $meta += [pscustomobject]@{ slot = $slot; name = $name; title = $c.title; url = $c.url; bytes = $b.Length }
      Log "   [OK] $name $($b.Length) :: $($c.title)"
    } else { Log "   [$i] reject $k $($b.Length) :: $($c.title)" }
  }
  if (Test-Path (Join-Path $candDir 'meta.json')) {
    $old = Get-Content (Join-Path $candDir 'meta.json') -Raw | ConvertFrom-Json
    $meta = @($old) + @($meta)
  }
  $meta | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $candDir 'meta.json') -Encoding UTF8
}

$plan = @(
  @{ slot = 'p03'; wiki = @('Spark plug'); search = @('spark plug NGK', 'motorcycle spark plug') },
  @{ slot = 'p07'; wiki = @('Cylinder head', 'Engine block'); search = @('motorcycle cylinder head', 'cylinder block fins engine', 'Honda engine cylinder') },
  @{ slot = 'p09'; wiki = @('Air filter'); search = @('motorcycle air filter element', 'engine air filter paper', 'air cleaner filter box car') },
  @{ slot = 'p10'; wiki = @('Piston ring', 'Piston'); search = @('engine piston rings set', 'motorcycle piston kit') },
  @{ slot = 'p14'; wiki = @('Shock absorber'); search = @('motorcycle rear shock absorber', 'motorcycle suspension spring shock') },
  @{ slot = 'p16'; wiki = @('Fuel tank'); search = @('motorcycle fuel tank petrol', 'Honda motorcycle tank') },
  @{ slot = 'p19'; wiki = @('Bowden cable'); search = @('bicycle brake cable', 'motorcycle brake cable lever') },
  @{ slot = 'p20'; wiki = @('Headlamp'); search = @('motorcycle headlight', 'motorcycle headlamp chrome round') }
)

foreach ($j in $plan) {
  Save-Candidates $j.slot $j.wiki $j.search
  Start-Sleep -Milliseconds 800
}
Log '--- DONE ---'
