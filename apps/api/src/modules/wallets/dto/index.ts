import { IsNumber, Min } from 'class-validator';

export class FundWalletDto {
  @IsNumber()
  @Min(100)
  amount!: number;
}
