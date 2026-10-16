CREATE TABLE "ShortLink" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "originalUrl" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "clickCount" INTEGER NOT NULL DEFAULT 0 CHECK ("clickCount" >= 0)
);
