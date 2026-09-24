# INEC Election Laws source documents

This directory is populated from the official INEC **Sheria za Uchaguzi** collection.

Source collection: https://www.inec.go.tz/publications/election-laws

Run from the repository root on Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\download-inec-election-laws.ps1
```

The downloader stores the original PDFs under this directory and creates `source-manifest.json` with the official source URL and SHA-256 hash for each file.

These PDFs are source artifacts. Structured Law Library JSON should be generated separately under `public/laws/<law-id>/` and must preserve the source text and hierarchy.
