import { Module } from "@nestjs/common";
import { SystemConfigController } from "./system-config.controller";

@Module({
  controllers: [SystemConfigController]
})
export class SystemConfigModule {}
