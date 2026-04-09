import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

@ApiTags("audit")
@Controller("audit")
export class AuditController {
  @Get()
  listAuditEvents() {
    return {
      items: [],
      message: "Audit module scaffold"
    };
  }
}
