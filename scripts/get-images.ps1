$ErrorActionPreference  = 'Continue'
$ProgressPreference    = 'SilentlyContinue'
$ua                    = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
$root                  = 'F:\websites\moto-gari\assets'
$prodDir               = Join-Path $root 'products'
$tmp                   = Join-Path $env:TEMP 'mg-dl'
New-Item -ItemType Directory -Force -Path $prodDir, $tmp | Out-Null
$log                   = Join-Path $env:TEMP 'mg-dl-log.txt'
"" | Set-Content -Path $log -Encoding UTF8

function Log([string]$m) {
  Add-Content -Path $log -Value $m -Encoding UTF8
  Write-Host $m
}

function Test-Magic([byte[]]$b) {
  if ($b.Length -lt 4) { return $null }
  if ($b[0] -eq 0xFF -and $b[1] -eq 0xD8 -and $b[2] -eq 0xFF) { return 'jpg' }
  if ($b[0] -eq 0x89 -and $b[1] -eq 0x50 -and $b[2] -eq 0x4E -and $b[3] -eq 0x47) { return 'png' }
  if ($b[0] -eq 0x47 -and $b[1] -eq 0x49 -and $b[2] -eq 0x46) { return 'gif' }
  if (($b[0] -eq 0x3C) -or ($b[0] -eq 0x7B)) { return 'html' }
  return 'unknown'
}

$allowed = 'staticflickr.com', 'upload.wikimedia.org', 'pixabay.com', 'pexels.com',
           'unsplash.com', 'wikimedia.org', 'flickr.com', 'wikimedia-cdn', 'openverse'

function Test-Host([string]$h) {
  foreach ($a in $allowed) { if ($h -like "*$a*") { return $true } }
  return $false
}

function Get-Candidates([string]$query) {
  $q  = [uri]::EscapeDataString($query)
  $u  = "https://api.openverse.org/v1/images/?q=$q&page_size=24"
  try {
    $r = Invoke-RestMethod -Uri $u -UserAgent $ua -TimeoutSec 45
  } catch {
    Log "  API FAIL $query :: $($_.Exception.Message)"
    return @()
  }
  $words = ($query -split '\s+') | Where-Object { $_.Length -gt 2 }
  $list  = @()
  foreach ($x in $r.results) {
    if (-not (Test-Host ([uri]$x.url).Host)) { continue }
    if ($x.width -and $x.width -lt 400) { continue }
    if ($x.height -and $x.height -lt 300) { continue }
    $score = 0
    $title = "$($x.title) $($x.tags -join ' ')".ToLower()
    foreach ($w in $words) { if ($title -like "*$($w.ToLower())*") { $score += 5 } }
    if ($x.width -ge 800) { $score += 2 }
    $list += [pscustomobject]@{ url = $x.url; score = $score; title = $x.title }
  }
  return ($list | Sort-Object -Property score -Descending)
}

function Get-Fallback([string]$name) {
  # guaranteed reachable static services (picsum is blocked on this network)
  $urls = @(
    "https://placehold.co/600x600/0b0d12/E4002B/png?text=$([uri]::EscapeDataString($name))&font=roboto"
  )
  foreach ($u in $urls) {
    $t = Join-Path $tmp 'fb.bin'
    try { Invoke-WebRequest -Uri $u -OutFile $t -UserAgent $ua -TimeoutSec 30 } catch { continue }
    $b = [IO.File]::ReadAllBytes($t)
    $k = Test-Magic $b
    if (($k -eq 'png' -or $k -eq 'jpg') -and $b.Length -gt 4096) { return @{ bytes = $b; ext = $k; src = $u } }
  }
  return $null
}

function Save-Product([string]$file, [string]$query, [string]$label, [string]$dir = $prodDir) {
  $target = Join-Path $dir $file
  $cands  = Get-Candidates $query
  Log "== $file  query='$query'  candidates=$($cands.Count)"
  $i = 0
  foreach ($c in $cands) {
    $i++
    $t = Join-Path $tmp 'cand.bin'
    try {
      Invoke-WebRequest -Uri $c.url -OutFile $t -UserAgent $ua -TimeoutSec 40 -MaximumRedirection 6
    } catch {
      Log "   [$i] dl-fail $($c.url) :: $($_.Exception.Message)"
      continue
    }
    $b = [IO.File]::ReadAllBytes($t)
    $k = Test-Magic $b
    if (($k -eq 'jpg' -or $k -eq 'png') -and $b.Length -gt 8192) {
      $ext   = if ($k -eq 'jpg') { '.jpg' } else { '.png' }
      $final = [IO.Path]::ChangeExtension($target, $ext)
      [IO.File]::WriteAllBytes($final, $b)
      Log "   [OK] $($b.Length) bytes -> $(Split-Path $final -Leaf)  src=$($c.url)"
      if ($final -ne $target -and (Test-Path $target)) { Remove-Item $target -Force }
      return $true
    }
    Log "   [$i] reject type=$k size=$($b.Length) $($c.url)"
  }
  $fb = Get-Fallback $label
  if ($fb) {
    $ext   = if ($fb.ext -eq 'jpg') { '.jpg' } else { '.png' }
    $final = Join-Path $dir ([IO.Path]::ChangeExtension($file, $ext))
    [IO.File]::WriteAllBytes($final, $fb.bytes)
    Log "   [FALLBACK] $($fb.bytes.Length) bytes -> $(Split-Path $final -Leaf)  src=$($fb.src)"
    return $true
  }
  Log "   [FAILED] no image for $file"
  return $false
}

$jobs = @(
  @{ f = 'p01.jpg';  q = 'motorcycle air filter element';        l = 'Air Filter' },
  @{ f = 'p02.jpg';  q = 'engine oil filter cartridge';          l = 'Oil Filter' },
  @{ f = 'p03.jpg';  q = 'spark plug ngk';                      l = 'Spark Plug' },
  @{ f = 'p04.jpg';  q = 'motorcycle drum brake shoe';           l = 'Brake Shoe' },
  @{ f = 'p05.jpg';  q = 'motorcycle sprocket chain wheel';      l = 'Chain Sprocket' },
  @{ f = 'p06.jpg';  q = 'clutch plate disc engine';             l = 'Clutch Plate' },
  @{ f = 'p07.jpg';  q = 'motorcycle engine cylinder head';      l = 'Cylinder Block' },
  @{ f = 'p08.jpg';  q = 'motorcycle tyre wheel';                l = 'Tyre' },
  @{ f = 'p09.jpg';  q = 'motorcycle air cleaner carburetor box';l = 'Air Filter 125' },
  @{ f = 'p10.jpg';  q = 'engine piston and rings';              l = 'Piston Kit' },
  @{ f = 'p11.jpg';  q = 'motorcycle chain drive sprocket';      l = 'Chain Kit 125' },
  @{ f = 'p12.jpg';  q = 'motorcycle carburetor';                l = 'Carburetor' },
  @{ f = 'p13.jpg';  q = 'starter motor automobile';             l = 'Starter Motor' },
  @{ f = 'p14.jpg';  q = 'motorcycle rear shock absorber';       l = 'Shock Absorber' },
  @{ f = 'p15.jpg';  q = 'motorcycle exhaust muffler chrome';    l = 'Silencer' },
  @{ f = 'p16.jpg';  q = 'motorcycle fuel tank';                 l = 'Fuel Tank' },
  @{ f = 'p17.jpg';  q = 'motorcycle rear view mirror';          l = 'Mirror' },
  @{ f = 'p18.jpg';  q = 'motorcycle control cable clutch';      l = 'Clutch Cable' },
  @{ f = 'p19.jpg';  q = 'bicycle brake cable lever';            l = 'Brake Cable' },
  @{ f = 'p20.jpg';  q = 'motorcycle headlight lamp';            l = 'Headlight' }
)

foreach ($j in $jobs) {
  $existing = Get-ChildItem -Path $prodDir -Filter ([IO.Path]::ChangeExtension($j.f, '*')) -ErrorAction SilentlyContinue
  if ($existing -and $existing.Length -gt 8192) { Log "skip $($j.f) (exists)"; continue }
  $null = Save-Product $j.f $j.q $j.l
  Start-Sleep -Milliseconds 1500
}

# hero + 3 category images
$rootJobs = @(
  @{ f = 'hero.jpg';      q = 'honda motorcycle black studio';  l = 'MotoGari Hero' },
  @{ f = 'cat-engine.jpg';  q = 'motorcycle engine close up';   l = 'Engine' },
  @{ f = 'cat-brakes.jpg';  q = 'motorcycle brake disc wheel';  l = 'Brakes' },
  @{ f = 'cat-electric.jpg';q = 'motorcycle headlight handlebar'; l = 'Electrical' }
)
foreach ($j in $rootJobs) {
  $existing = Get-ChildItem -Path $root -Filter ([IO.Path]::ChangeExtension($j.f, '*')) -ErrorAction SilentlyContinue
  if ($existing -and $existing.Length -gt 8192) { Log "skip $($j.f) (exists)"; continue }
  $null = Save-Product $j.f $j.q $j.l
  Start-Sleep -Milliseconds 1500
}

Log "--- DONE ---"
