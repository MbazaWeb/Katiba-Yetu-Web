# Katiba Yetu Web

A digital constitutional platform for Tanzania to read, explore, discuss, propose, and participate in constitutional matters.

Web-first architecture, designed so the constitutional data and backend can later be reused by the Katiba Yetu mobile application.

## Importing the constitutional dataset

The supplied source dataset is normalized at build/development time. Keep the extracted source folder as `katiba file/` in the repository root, then run:

`npm run import:katiba`

The importer preserves source provenance and creates `public/katiba-data/documents.json`, `chapters.json`, `articles.json`, `appendices.json`, and `manifest.json`. Official constitutions and drafts remain separate, and the source verification status is preserved rather than upgraded automatically.
