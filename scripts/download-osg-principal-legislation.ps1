param(
  [string]$CollectionUuid = "62657fa2-7c35-4664-bcf1-88a01869d835",
  [string]$OutputDir = "public/docs/principal-legislation",
  [int]$PageSize = 100,
  [switch]$InventoryOnly
)
$ErrorActionPreference="Stop"; $ProgressPreference="SilentlyContinue"
$Api="https://elibrary.osg.go.tz/server/api"
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
function Slug([string]$s){if(!$s){return "document"};$s=$s.ToLowerInvariant()-replace '[^a-z0-9]+','-';$s=$s.Trim('-');if($s.Length-gt 110){$s=$s.Substring(0,110).Trim('-')};if(!$s){return "document"};return $s}
function Get-Json([string]$u){Invoke-RestMethod -Uri $u -Headers @{"Accept"="application/json";"User-Agent"="Katiba-Yetu-Law-Library/1.1"}}

# DSpace 7/8: enumerate collection membership directly. The previous Discover
# response shape can legitimately expose zero embedded objects on this deployment.
$items=@();$page=0
do{
 Write-Host "Inventory page $($page+1)..."
 $r=Get-Json "$Api/core/collections/$CollectionUuid/items?size=$PageSize&page=$page"
 $batch=@($r._embedded.items)
 foreach($x in $batch){if($x.uuid){$items+=[pscustomobject]@{uuid=$x.uuid;name=$x.name;handle=$x.handle;type=$x.type;url="https://elibrary.osg.go.tz/items/$($x.uuid)"}}}
 $page++;$totalPages=[int]$r.page.totalPages
}while($page-lt$totalPages)
$items=@($items|Sort-Object uuid -Unique)
Write-Host "Found $($items.Count) collection item(s)."
if($items.Count-eq 0){throw "OSG collection returned 0 items. No empty manifest was written."}

$manifest=@();$counter=0
foreach($item in $items){
 $counter++;Write-Host "[$counter/$($items.Count)] $($item.name)"
 try{
  $bundles=Get-Json "$Api/core/items/$($item.uuid)/bundles?size=100"
  $original=@($bundles._embedded.bundles|Where-Object{$_.name-eq"ORIGINAL"})|Select-Object -First 1
  if(!$original){continue}
  $bits=Get-Json "$Api/core/bundles/$($original.uuid)/bitstreams?size=100"
  foreach($pdf in @($bits._embedded.bitstreams|Where-Object{$_.name-match'(?i)\.pdf$'})){
   $cap=$null;if($item.name-match'(?i)(?:chapter|cap\.?|sura(?:\s+ya)?)\s*(\d+[A-Za-z]?)'){$cap=$Matches[1]}
   $prefix=if($cap){"cap-$cap"}else{"{0:D4}"-f$counter};$fileName="$prefix-$(Slug $item.name).pdf";$path=Join-Path $OutputDir $fileName
   if(!$InventoryOnly-and!(Test-Path $path)){Invoke-WebRequest -Uri "$Api/core/bitstreams/$($pdf.uuid)/content" -OutFile $path -Headers @{"User-Agent"="Katiba-Yetu-Law-Library/1.1"} -UseBasicParsing}
   $manifest+=[pscustomobject]@{title=$item.name;cap=$cap;item_uuid=$item.uuid;handle=$item.handle;item_url=$item.url;bitstream_uuid=$pdf.uuid;original_filename=$pdf.name;file=$fileName;sha256=$(if(Test-Path $path){(Get-FileHash -Algorithm SHA256 $path).Hash.ToLowerInvariant()}else{$null});collection_uuid=$CollectionUuid}
  }
 }catch{Write-Warning "Failed: $($item.name) :: $($_.Exception.Message)"}
}
$out=[pscustomobject]@{source="Office of the Solicitor General e-Library";collection="Principal Legislation";collection_uuid=$CollectionUuid;collection_url="https://elibrary.osg.go.tz/collections/$CollectionUuid/search";generated_at_utc=[DateTime]::UtcNow.ToString("o");item_count=$items.Count;pdf_count=$manifest.Count;documents=$manifest}
$out|ConvertTo-Json -Depth 8|Set-Content -Encoding UTF8 (Join-Path $OutputDir "source-manifest.json")

# Front-end staging index: every downloaded PDF becomes visible immediately,
# even before law.json/section conversion is completed.
if(!$InventoryOnly){
 $library=@($manifest|Where-Object{Test-Path (Join-Path $OutputDir $_.file)}|ForEach-Object{
  $yr=$null;if($_.title-match'\b(19|20)\d{2}\b'){$yr=[int]$Matches[0]}
  [pscustomobject]@{id=("source-"+(Slug $_.title)+"-"+$_.item_uuid.Substring(0,8));title=$_.title;shortTitle=$_.title;chapterNumber=$(if($_.cap){$_.cap}else{"N/A"});year=$yr;edition="Official source document";category="Principal Legislation";source="Office of the Solicitor General e-Library";sourcePdf=("/docs/principal-legislation/"+$_.file);contentReady=$false;status="awaiting-conversion";itemUrl=$_.item_url}
 })
 $idx=[pscustomobject]@{generated_at_utc=[DateTime]::UtcNow.ToString("o");documents=$library}
 $idx|ConvertTo-Json -Depth 6|Set-Content -Encoding UTF8 "public/docs/library-index.json"
}
Write-Host "Done. PDFs: $($manifest.Count)"
Write-Host "Manifest: $OutputDir/source-manifest.json"
if(!$InventoryOnly){Write-Host "Frontend index: public/docs/library-index.json"}
