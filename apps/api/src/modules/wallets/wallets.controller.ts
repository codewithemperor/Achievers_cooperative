import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

@ApiTags("wallets")
@Controller("wallets")
export class WalletsController {
  @Get()
  listWallets() {
    return {
      items: [],
      message: "Wallet module scaffold"
    };
  }
}
