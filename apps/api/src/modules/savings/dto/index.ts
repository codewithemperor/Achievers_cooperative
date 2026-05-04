import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class ContributeSavingsDto {
  @IsNumber()
  @Min(100)
  amount!: number;
}

export class RequestSavingsWithdrawalDto {
  @IsNumber()
  @Min(100)
  amount!: number;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsString()
  accountName?: string;

  @IsOptional()
  @IsString()
  bankAccountId?: string;

  @IsOptional()
  @IsString()
  savingsAccountId?: string;
}
