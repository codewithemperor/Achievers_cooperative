import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class ApplyLoanDto {
  @IsOptional()
  @IsString()
  memberId?: string;

  @IsOptional()
  @IsString()
  guarantorOneId?: string;

  @IsOptional()
  @IsString()
  guarantorTwoId?: string;

  @IsNumber()
  @Min(1000)
  amount!: number;

  @IsNumber()
  @Min(1)
  tenorMonths!: number;

  @IsString()
  @IsNotEmpty()
  purpose!: string;

  @IsOptional()
  @IsString()
  bankAccountId?: string;
}

export class QueryLoansDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  page?: number = 1;

  @IsOptional()
  limit?: number = 20;
}

export class RepayLoanDto {
  @IsNumber()
  @Min(100)
  amount!: number;
}
