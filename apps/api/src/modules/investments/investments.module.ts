import { Module } from "@nestjs/common";
import { InvestmentsController } from "./investments.controller";

@Module({
  controllers: [InvestmentsController]
})
export class InvestmentsModule {}
