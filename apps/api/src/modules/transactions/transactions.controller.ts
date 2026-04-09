import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

@ApiTags("transactions")
@Controller("transactions")
export class TransactionsController {
  @Get()
  listTransactions() {
    return {
      items: [],
      message: "Transaction history scaffold"
    };
  }
}
