import { Module } from "@nestjs/common";
import { SavingsController } from "./savings.controller";

@Module({
  controllers: [SavingsController]
})
export class SavingsModule {}
