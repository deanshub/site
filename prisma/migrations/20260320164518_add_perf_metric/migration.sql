-- CreateTable
CREATE TABLE "PageView" (
    "id" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerfMetric" (
    "id" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerfMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PageView_pathname_idx" ON "PageView"("pathname");

-- CreateIndex
CREATE INDEX "PageView_timestamp_idx" ON "PageView"("timestamp");

-- CreateIndex
CREATE INDEX "PerfMetric_pathname_idx" ON "PerfMetric"("pathname");

-- CreateIndex
CREATE INDEX "PerfMetric_name_idx" ON "PerfMetric"("name");

-- CreateIndex
CREATE INDEX "PerfMetric_timestamp_idx" ON "PerfMetric"("timestamp");
