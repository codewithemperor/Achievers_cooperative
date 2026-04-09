import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

@ApiTags("loans")
@Controller("loans")
export class LoansController {
  @Get()
  listLoanApplications() {
    return {
      items: [],
      message: "Loan module scaffold"
    };
  }
}
