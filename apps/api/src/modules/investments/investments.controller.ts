import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

@ApiTags("investments")
@Controller("investments")
export class InvestmentsController {
  @Get()
  listInvestmentProducts() {
    return {
      items: [],
      message: "Investment module scaffold"
    };
  }
}
