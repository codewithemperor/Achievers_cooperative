import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

@ApiTags("savings")
@Controller("savings")
export class SavingsController {
  @Get()
  listSavingsAccounts() {
    return {
      items: [],
      message: "Savings module scaffold"
    };
  }
}
