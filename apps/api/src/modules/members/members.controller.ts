import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

@ApiTags("members")
@Controller("members")
export class MembersController {
  @Get()
  listMembers() {
    return {
      items: [],
      message: "Member management module scaffold"
    };
  }
}
