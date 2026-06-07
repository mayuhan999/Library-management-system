-- R3: messaging, hold workflow, copy incidents, fine payment tracking

-- Redefine HoldStatus (SQLite: recreate Hold table)
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Hold" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "queuePosition" INTEGER,
    "placedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "approvedAt" DATETIME,
    "readyAt" DATETIME,
    "fulfilledAt" DATETIME,
    "cancelledAt" DATETIME,
    "cancelReason" TEXT,
    CONSTRAINT "Hold_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Hold_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Hold" ("id", "userId", "bookId", "status", "queuePosition", "placedAt", "expiresAt", "fulfilledAt", "cancelledAt")
SELECT "id", "userId", "bookId", "status", "queuePosition", "placedAt", "expiresAt", "fulfilledAt", "cancelledAt" FROM "Hold";
DROP TABLE "Hold";
ALTER TABLE "new_Hold" RENAME TO "Hold";
CREATE INDEX "Hold_bookId_status_placedAt_idx" ON "Hold"("bookId", "status", "placedAt");
CREATE INDEX "Hold_userId_status_idx" ON "Hold"("userId", "status");

-- Loan: finePaid column
ALTER TABLE "Loan" ADD COLUMN "finePaid" BOOLEAN NOT NULL DEFAULT false;

-- BookCopyIncident
CREATE TABLE "BookCopyIncident" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookCopyId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "notes" TEXT,
    "fineAmount" REAL NOT NULL DEFAULT 0,
    "reportedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookCopyIncident_bookCopyId_fkey" FOREIGN KEY ("bookCopyId") REFERENCES "BookCopy" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "BookCopyIncident_bookId_createdAt_idx" ON "BookCopyIncident"("bookId", "createdAt");
CREATE INDEX "BookCopyIncident_bookCopyId_idx" ON "BookCopyIncident"("bookCopyId");
CREATE INDEX "BookCopyIncident_type_createdAt_idx" ON "BookCopyIncident"("type", "createdAt");

-- InAppMessage
CREATE TABLE "InAppMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InAppMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "InAppMessage_userId_readAt_idx" ON "InAppMessage"("userId", "readAt");
CREATE INDEX "InAppMessage_userId_createdAt_idx" ON "InAppMessage"("userId", "createdAt");
CREATE INDEX "InAppMessage_relatedEntityType_relatedEntityId_type_idx" ON "InAppMessage"("relatedEntityType", "relatedEntityId", "type");

PRAGMA foreign_keys=ON;
