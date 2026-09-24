# Tanzania Principal Legislation source library

Official source: Office of the Solicitor General e-Library.

Collection: https://elibrary.osg.go.tz/collections/62657fa2-7c35-4664-bcf1-88a01869d835/search

The collection is the OSG **Principal Legislation** collection. Source PDFs are retained here before any JSON conversion.

## Download / refresh

From the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\download-osg-principal-legislation.ps1
```

Inventory without downloading PDF bytes:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\download-osg-principal-legislation.ps1 -InventoryOnly
```

The script uses the public OSG/DSpace REST API, enumerates the collection, resolves each item's ORIGINAL bundle, downloads PDF bitstreams, and writes `source-manifest.json` with item/bitstream identifiers and SHA-256 hashes.

Do not convert these files into Law Library JSON until the source inventory and edition policy have been reviewed. Prefer the newest authoritative revised edition/annual supplement when duplicate Acts or CAPs exist, while retaining older editions as source history when needed.
