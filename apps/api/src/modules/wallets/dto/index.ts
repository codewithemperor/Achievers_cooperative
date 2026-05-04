import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class FundWalletDto {
  @IsNumber()
  @Min(100)
  amount!: number;
}

export class AdminWalletSpendDto {
  @IsString()
  memberId!: string;

  @IsString()
  @IsIn(['LOAN', 'PACKAGE', 'SAVINGS', 'WEEKLY_DEDUCTION'])
  targetType!: 'LOAN' | 'PACKAGE' | 'SAVINGS' | 'WEEKLY_DEDUCTION';

  @IsOptional()
  @IsString()
  targetId?: string;

  @IsOptional()
  @IsString()
  savingsAccountId?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  amount?: number;
}
