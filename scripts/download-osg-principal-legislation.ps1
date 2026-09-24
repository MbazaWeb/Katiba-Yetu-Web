param(
  [string]$CollectionUuid = "62657fa2-7c35-4664-bcf1-88a01869d835",
  [string]$OutputDir = "public/docs/principal-legislation",
  [int]$PageSize = 100,
  [switch]$InventoryOnly
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$Api = "https://elibrary.osg.go.tz/server/api"
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

function Slug([string]$s) {
  if (!$s) { return "document" }
  $s = $s.ToLowerInvariant() -replace '[^a-z0-9]+','-'
  $s = $s.Trim('-')
  if ($s.Length -gt 110) { $s = $s.Substring(0,110).Trim('-') }
  if (!$s) { return "document" }
  return $s
}
function Get-Json([string]$Url) {
  return Invoke-RestMethod -Uri $Url -Headers @{"Accept"="application/json";"User-Agent"="Katiba-Yetu-Law-Library/1.0"}
}

$items = @()
$page = 0
do {
  Write-Host "Inventory page $($page + 1)..."
  $url = "$Api/discover/search/objects?scope=$CollectionUuid&size=$PageSize&page=$page"
  $r = Get-Json $url
  $batch = @($r._embedded.searchResult._embedded.objects | Where-Object { $_.indexableObject.uuid })
  foreach ($o in $batch) {
    $x = $o.indexableObject
    $items += [pscustomobject]@{
      uuid = $x.uuid
      name = $x.name
      handle = $x.handle
      type = $x.type
      url = "https://elibrary.osg.go.tz/items/$($x.uuid)"
    }
  }
  $page++
  $totalPages = [int]$r.page.totalPages
} while ($page -lt $totalPages)

$items = @($items | Sort-Object uuid -Unique)
Write-Host "Found $($items.Count) collection item(s)."

$manifest = @()
$counter = 0
foreach ($item in $items) {
  $counter++
  Write-Host "[$counter/$($items.Count)] $($item.name)"
  try {
    $bundles = Get-Json "$Api/core/items/$($item.uuid)/bundles?size=100"
    $original = @($bundles._embedded.bundles | Where-Object { $_.name -eq "ORIGINAL" }) | Select-Object -First 1
    if (!$original) { continue }

    $bits = Get-Json "$Api/core/bundles/$($original.uuid)/bitstreams?size=100"
    $pdfs = @($bits._embedded.bitstreams | Where-Object { $_.name -match '(?i)\.pdf$' })
    foreach ($pdf in $pdfs) {
      $cap = $null
      if ($item.name -match '(?i)(?:chapter|cap\.?|sura(?:\s+ya)?)\s*(\d+[A-Za-z]?)') { $cap = $Matches[1] }
      $prefix = if ($cap) { "cap-$cap" } else { "{0:D4}" -f $counter }
      $fileName = "$prefix-$(Slug $item.name).pdf"
      $path = Join-Path $OutputDir $fileName
      $contentUrl = "$Api/core/bitstreams/$($pdf.uuid)/content"

      if (!$InventoryOnly -and !(Test-Path $path)) {
        Invoke-WebRequest -Uri $contentUrl -OutFile $path -Headers @{"User-Agent"="Katiba-Yetu-Law-Library/1.0"} -UseBasicParsing
      }

      $hash = if (Test-Path $path) { (Get-FileHash -Algorithm SHA256 $path).Hash.ToLowerInvariant() } else { $null }
      $manifest += [pscustomobject]@{
        title = $item.name
        cap = $cap
        item_uuid = $item.uuid
        handle = $item.handle
        item_url = $item.url
        bitstream_uuid = $pdf.uuid
        original_filename = $pdf.name
        file = $fileName
        sha256 = $hash
        collection_uuid = $CollectionUuid
      }
    }
  } catch {
    Write-Warning "Failed: $($item.name) :: $($_.Exception.Message)"
  }
}

$out = [pscustomobject]@{
  source = "Office of the Solicitor General e-Library"
  collection = "Principal Legislation"
  collection_uuid = $CollectionUuid
  collection_url = "https://elibrary.osg.go.tz/collections/$CollectionUuid/search"
  generated_at_utc = [DateTime]::UtcNow.ToString("o")
  item_count = $items.Count
  pdf_count = $manifest.Count
  documents = $manifest
}
$out | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 (Join-Path $OutputDir "source-manifest.json")
Write-Host "Done. PDFs: $($manifest.Count)"
Write-Host "Manifest: $OutputDir/source-manifest.json"
