import { Body, Controller, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

class SignInDto {
  email!: string;
  password!: string;
}

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  @Post("sign-in")
  signIn(@Body() body: SignInDto) {
    return {
      message: "Authentication scaffold ready",
      email: body.email
    };
  }
}
