-- AlertTable: candle-close alerts store the selected timeframe (null for others)
ALTER TABLE "Alert" ADD COLUMN "timeframe" TEXT;
