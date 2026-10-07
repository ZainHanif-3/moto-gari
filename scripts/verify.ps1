$ErrorActionPreference = 'Continue'
$base = 'http://localhost:3100'
$root = 'F:\websites\moto-gari'
$out  = @()
function Line($s) { $script:out += $s; Write-Output $s }
function Status($url) {
  try { $r = Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 15; return [int]$r.StatusCode } catch { return [int]$_.Exception.Response.StatusCode }
}

Line '=== MotoGari verification (PORT 3100) ==='

$p = Invoke-RestMethod "$base/api/products"
Line ("GET /api/products            -> " + $p.count + " items / " + $p.items.Count + " entries (expected 20)")

$m70 = Invoke-RestMethod "$base/api/products?model=CG70"
Line ("GET /api/products?model=CG70  -> " + $m70.count + " items: " + (($m70.items | ForEach-Object { $_.id }) -join ','))
$m125 = Invoke-RestMethod "$base/api/products?model=CG125"
Line ("GET /api/products?model=CG125 -> " + $m125.count + " items: " + (($m125.items | ForEach-Object { $_.id }) -join ','))

$c = Invoke-RestMethod "$base/api/products?category=Filters"
Line ("GET /api/products?category=Filters -> " + $c.count + " items")

$s = Invoke-RestMethod "$base/api/products?sort=price-asc"
Line ("GET /api/products?sort=price-asc   -> cheapest " + $s.items[0].id + " @ " + $s.items[0].price)
$sd = Invoke-RestMethod "$base/api/products?sort=price-desc"
Line ("GET /api/products?sort=price-desc  -> priciest " + $sd.items[0].id + " @ " + $sd.items[0].price)
$sf = Invoke-RestMethod "$base/api/products?sort=featured"
Line ("GET /api/products?sort=featured   -> first " + $sf.items[0].id + " (" + $sf.items[0].name + ")")

$q = Invoke-RestMethod "$base/api/products?search=brake"
Line ("GET /api/products?search=brake     -> " + $q.count + " items")
$mm = Invoke-RestMethod "$base/api/products?min=1000&max=3000"
Line ("GET /api/products?min=1000&max=3000-> " + $mm.count + " items")

$one = Invoke-RestMethod "$base/api/products/p12"
Line ("GET /api/products/p12         -> " + $one.item.name + " / " + $one.item.price + " PKR / image " + $one.item.image)
try { Invoke-RestMethod "$base/api/products/p99" | Out-Null; Line 'GET /api/products/p99         -> UNEXPECTED 200' }
catch { Line ("GET /api/products/p99         -> " + [int]$_.Exception.Response.StatusCode + " (expected 404)") }

$cats = Invoke-RestMethod "$base/api/categories"
Line ("GET /api/categories           -> " + $cats.Count + " categories: " + (($cats | ForEach-Object { $_.name }) -join ', '))
$mods = Invoke-RestMethod "$base/api/models"
Line ("GET /api/models               -> " + (($mods | ForEach-Object { $_.model + '=' + $_.count }) -join ', '))
$st = Invoke-RestMethod "$base/api/stats"
Line ("GET /api/stats                -> products=" + $st.products + " orders=" + $st.orders + " categories=" + $st.categories)

$body = @{
  name    = 'Verification Bot'
  phone   = '0300 1234567'
  city    = 'Lahore'
  address = 'House 12, Street 4, Model Town'
  note    = 'automated verification order'
  items   = @(@{ id = 'p01'; qty = 2 }, @{ id = 'p05'; qty = 1 })
} | ConvertTo-Json -Depth 5
try {
  $r = Invoke-RestMethod -Method Post -Uri "$base/api/orders" -ContentType 'application/json' -Body $body
  Line ("POST /api/orders (valid)      -> orderId=" + $r.orderId + " total=" + $r.total + " items=" + $r.itemsCount + " payment=" + $r.payment)
} catch { Line ("POST /api/orders (valid)      -> FAIL " + $_.Exception.Message) }

$bad = @{ name = 'X'; phone = '12345'; city = 'Lahore'; address = 'too short'; items = @() } | ConvertTo-Json -Depth 5
try { Invoke-RestMethod -Method Post -Uri "$base/api/orders" -ContentType 'application/json' -Body $bad | Out-Null; Line 'POST /api/orders (invalid)    -> UNEXPECTED 200' }
catch { Line ("POST /api/orders (invalid)    -> " + [int]$_.Exception.Response.StatusCode + " (expected 400)") }

$over = @{ name = 'Ali Khan'; phone = '03331234567'; city = 'Karachi'; address = 'Clifton Block 4 near the park'; items = @(@{ id = 'p16'; qty = 99 }) } | ConvertTo-Json -Depth 5
try { Invoke-RestMethod -Method Post -Uri "$base/api/orders" -ContentType 'application/json' -Body $over | Out-Null; Line 'POST /api/orders (over stock) -> UNEXPECTED 200' }
catch { Line ("POST /api/orders (over stock) -> " + [int]$_.Exception.Response.StatusCode + " (expected 400)") }

$ordersRaw = Get-Content "$root\data\orders.json" -Raw | ConvertFrom-Json
$orderCount = if ($ordersRaw -is [array]) { $ordersRaw.Count } else { $ordersRaw.orders.Count }
Line ("data/orders.json              -> " + $orderCount + " order(s) stored on disk")

Line ("GET /                         -> " + (Status "$base/") + " contains MotoGari=" + ((Invoke-WebRequest "$base/" -UseBasicParsing).Content -like '*MotoGari*'))
Line ("GET /admin                    -> " + (Status "$base/admin"))
Line ("GET /nope                     -> " + (Status "$base/nope") + " (expected 404)")
Line ("GET /assets/products/p01.jpg  -> " + (Status "$base/assets/products/p01.jpg"))
Line ("GET /api/health               -> " + ((Invoke-RestMethod "$base/api/health") | ConvertTo-Json -Compress))

Line ''
Line '=== image validation (magic bytes + size) ==='
$bad = 0
1..20 | ForEach-Object {
  $id = 'p{0:d2}' -f $_
  $f = Get-ChildItem "$root\assets\products\$id.*" -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $f) { Line "$id -> MISSING"; $script:bad++; return }
  $b = [IO.File]::ReadAllBytes($f.FullName)
  $magic = if ($b[0] -eq 0xFF -and $b[1] -eq 0xD8 -and $b[2] -eq 0xFF) { 'jpg' } elseif ($b[0] -eq 0x89 -and $b[1] -eq 0x50) { 'png' } else { 'INVALID' }
  $ok = ($magic -ne 'INVALID') -and ($b.Length -gt 8192)
  if (-not $ok) { $script:bad++ }
  Line ("$($f.Name)  $($b.Length.ToString().PadLeft(8)) bytes  $magic  " + $(if ($ok) { 'OK' } else { 'FAIL' }))
}
Line ("image summary                 -> " + (20 - $bad) + "/20 valid, " + $bad + " invalid")
$extra = @('hero.jpg', 'cat-engine.jpg', 'cat-brakes.jpg', 'cat-electrical.jpg')
foreach ($e in $extra) {
  $f = Get-ChildItem "$root\assets\$e" -ErrorAction SilentlyContinue
  if ($f -and $f.Length -gt 8192) { Line "$e $($f.Length) bytes OK" } else { Line "$e MISSING/SMALL"; $script:bad++ }
}

$out | Set-Content "$root\scripts\verify-out.txt" -Encoding UTF8
