-- Book catalog barcode + Alipay payment ledger

ALTER TABLE "Book" ADD COLUMN "barcode" TEXT;
CREATE UNIQUE INDEX "Book_barcode_key" ON "Book"("barcode");
CREATE INDEX "Book_barcode_idx" ON "Book"("barcode");

CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "loanId" TEXT,
    "amount" REAL NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'ALIPAY',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "outTradeNo" TEXT NOT NULL,
    "tradeNo" TEXT,
    "subject" TEXT,
    "paidAt" DATETIME,
    "notifyRaw" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Payment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Payment_outTradeNo_key" ON "Payment"("outTradeNo");
CREATE INDEX "Payment_userId_status_idx" ON "Payment"("userId", "status");
CREATE INDEX "Payment_loanId_idx" ON "Payment"("loanId");
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");
CREATE INDEX "Payment_paidAt_idx" ON "Payment"("paidAt");

-- Backfill catalog barcode from ISBN for existing titles
UPDATE "Book" SET "barcode" = REPLACE(REPLACE("isbn", '-', ''), ' ', '') WHERE "barcode" IS NULL;
