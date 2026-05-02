import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateBankAccountDto {
  @IsString()
  @IsNotEmpty()
  bankCode!: string;

  @IsString()
  @IsNotEmpty()
  accountNumber!: string;

  @IsString()
  @IsNotEmpty()
  accountName!: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  isDefault?: boolean;
}

export class UpdateBankAccountDto {
  @IsOptional()
  @IsString()
  bankCode?: string;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsString()
  accountName?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  isDefault?: boolean;
}

export class VerifyBankAccountDto {
  @IsString()
  @IsNotEmpty()
  bankCode!: string;

  @IsString()
  @IsNotEmpty()
  accountNumber!: string;
}
