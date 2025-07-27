-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "archetypeId" TEXT,
    "heightIn" INTEGER,
    "weightLb" INTEGER,
    "handedness" TEXT,
    "sourceType" TEXT NOT NULL,
    "devTrait" TEXT NOT NULL,
    "devCap" INTEGER,
    "enrollmentYear" INTEGER NOT NULL,
    "redshirt" BOOLEAN NOT NULL DEFAULT false,
    "transferFrom" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Player_archetypeId_fkey" FOREIGN KEY ("archetypeId") REFERENCES "Archetype" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Archetype" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "position" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subsetKeys" TEXT NOT NULL,
    "baseTemplate" TEXT,
    "mappingConfig" TEXT
);

-- CreateTable
CREATE TABLE "RatingSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerId" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "ratings" TEXT NOT NULL,
    "ovr" INTEGER NOT NULL,
    "predicted" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RatingSnapshot_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Formation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "side" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "variant" TEXT
);

-- CreateTable
CREATE TABLE "FormationSlot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "formationId" TEXT NOT NULL,
    "slotKey" TEXT NOT NULL,
    "positionHints" TEXT NOT NULL,
    "x" REAL NOT NULL,
    "y" REAL NOT NULL,
    CONSTRAINT "FormationSlot_formationId_fkey" FOREIGN KEY ("formationId") REFERENCES "Formation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
