-- ================================================================
-- KATIBA YETU — SQLite Schema
-- ================================================================
DROP TABLE IF EXISTS articles;
DROP TABLE IF EXISTS chapters;
DROP TABLE IF EXISTS documents;

CREATE TABLE documents (
    document_id    TEXT PRIMARY KEY,
    title          TEXT NOT NULL,
    title_sw       TEXT,
    language       TEXT NOT NULL,
    type           TEXT NOT NULL,
    enacted_date   TEXT,
    total_chapters INTEGER,
    total_articles INTEGER,
    status         TEXT
);

CREATE TABLE chapters (
    chapter_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id    TEXT NOT NULL,
    chapter_number INTEGER NOT NULL,
    chapter_name   TEXT NOT NULL,
    title          TEXT NOT NULL,
    parts_count    INTEGER,
    articles_count INTEGER,
    path           TEXT,
    FOREIGN KEY (document_id) REFERENCES documents(document_id)
);

CREATE TABLE articles (
    article_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    chapter_id     INTEGER NOT NULL,
    document_id    TEXT NOT NULL,
    article_number TEXT NOT NULL,
    part           TEXT,
    title          TEXT NOT NULL,
    content        TEXT,
    sub_articles   TEXT,   -- JSON array as text
    status         TEXT,
    path           TEXT,
    FOREIGN KEY (chapter_id) REFERENCES chapters(chapter_id)
);

CREATE INDEX idx_articles_doc    ON articles(document_id);
CREATE INDEX idx_articles_chap   ON articles(chapter_id);
CREATE INDEX idx_articles_num    ON articles(article_number);
CREATE INDEX idx_chapters_doc    ON chapters(document_id);
