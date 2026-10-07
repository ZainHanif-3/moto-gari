$ErrorActionPreference = 'Stop'
$ProgressPreference   = 'SilentlyContinue'
$prod                 = 'F:\websites\moto-gari\assets\products'
$stage                = Join-Path $env:TEMP 'mg-stage'
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Force -Path $stage | Out-Null

# NOTE: keys are source files from the OLD pairing (see review sheet), values are destination slots.
$copy = [ordered]@{
  'p03.jpg' = 'p01.jpg'   # air filter elements   -> p01 Air Filter CG70
  'p05.jpg' = 'p04.jpg'   # brake shoes           -> p04 Brake Shoe Set
  'p07.jpg' = 'p05.jpg'   # chain + sprocket      -> p05 Chain Kit CG70
  'p09.jpg' = 'p06.jpg'   # clutch pack           -> p06 Clutch Plate Set
  'p18.jpg' = 'p08.jpg'   # tyre stack            -> p08 Tyre
  'p08.jpg' = 'p11.jpg'   # red chain             -> p11 Chain Kit CG125
  'p14.jpg' = 'p12.jpg'   # carburetor            -> p12 Carburetor
  'p19.jpg' = 'p13.jpg'   # starter motor         -> p13 Self Starter Motor
  'p10.jpg' = 'p15.jpg'   # exhaust muffler       -> p15 Silencer
  'p04.jpg' = 'p18.jpg'   # control cable         -> p18 Clutch Cable
  'p17.jpg' = 'p17.jpg'   # mirror                -> p17 Mirror Pair (unchanged)
  'p02.jpg' = 'p02.jpg'   # oil filter            -> p02 Oil Filter (unchanged)
}

foreach ($src in $copy.Keys) {
  $s = Join-Path $prod $src
  if (-not (Test-Path $s)) { Write-Warning "missing source $src"; continue }
  Copy-Item $s (Join-Path $stage $copy[$src]) -Force
}
foreach ($f in Get-ChildItem $stage) {
  Copy-Item $f.FullName (Join-Path $prod $f.Name) -Force
}
Write-Host ("staged " + (Get-ChildItem $stage).Count + " reshuffled images")
