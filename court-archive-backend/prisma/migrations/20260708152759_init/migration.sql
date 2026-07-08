-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'petugas');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('Available', 'Borrowed');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shelves" (
    "id" SERIAL NOT NULL,
    "rack_name" TEXT NOT NULL,
    "row_number" INTEGER NOT NULL,
    "slot_number" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shelves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "court_cases" (
    "id" SERIAL NOT NULL,
    "case_number_raw" TEXT NOT NULL,
    "case_number_clean" TEXT,
    "case_type" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "parties_involved" TEXT NOT NULL,
    "shelf_id" INTEGER,
    "file_position_number" TEXT,
    "status" "CaseStatus" NOT NULL DEFAULT 'Available',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "court_cases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- AddForeignKey
ALTER TABLE "court_cases" ADD CONSTRAINT "court_cases_shelf_id_fkey" FOREIGN KEY ("shelf_id") REFERENCES "shelves"("id") ON DELETE SET NULL ON UPDATE CASCADE;
