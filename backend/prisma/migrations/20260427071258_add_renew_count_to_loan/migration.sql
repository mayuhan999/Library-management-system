-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Loan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "borrowedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" DATETIME NOT NULL,
    "returnedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'BORROWED',
    "renewCount" INTEGER NOT NULL DEFAULT 0,
    "fineAmount" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Loan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Loan_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Loan" ("bookId", "borrowedAt", "createdAt", "dueAt", "fineAmount", "id", "notes", "returnedAt", "status", "updatedAt", "userId") SELECT "bookId", "borrowedAt", "createdAt", "dueAt", "fineAmount", "id", "notes", "returnedAt", "status", "updatedAt", "userId" FROM "Loan";
DROP TABLE "Loan";
ALTER TABLE "new_Loan" RENAME TO "Loan";
CREATE INDEX "Loan_userId_status_idx" ON "Loan"("userId", "status");
CREATE INDEX "Loan_bookId_status_idx" ON "Loan"("bookId", "status");
CREATE INDEX "Loan_dueAt_idx" ON "Loan"("dueAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
