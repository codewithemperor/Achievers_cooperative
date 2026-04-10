import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class SubscribeInvestmentDto {
  @IsString()
  productId!: string;

  @IsNumber()
  @Min(1000)
  principal!: number;
}

export class QueryInvestmentsDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  page?: number = 1;

  @IsOptional()
  limit?: number = 20;
}
