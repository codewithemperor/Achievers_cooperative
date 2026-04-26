import { Transform } from 'class-transformer';
import { IsDateString, IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { IDENTIFICATION_TYPE_OPTIONS, MARITAL_STATUS_OPTIONS, NIGERIAN_PHONE_REGEX } from '../../../common/member.constants';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(NIGERIAN_PHONE_REGEX, {
    message: 'Phone number must be 11 digits and start with 0',
  })
  phoneNumber!: string;

  @IsString()
  @IsNotEmpty()
  homeAddress!: string;

  @IsString()
  @IsNotEmpty()
  stateOfOrigin!: string;

  @IsDateString()
  dateOfBirth!: string;

  @IsString()
  @IsNotEmpty()
  occupation!: string;

  @IsIn(MARITAL_STATUS_OPTIONS)
  @Transform(({ value }) => value?.toUpperCase())
  maritalStatus!: string;

  @IsString()
  @IsNotEmpty()
  identificationNumber!: string;

  @IsString()
  @IsNotEmpty()
  identificationPicture!: string;

  @IsIn(IDENTIFICATION_TYPE_OPTIONS)
  @Transform(({ value }) => value?.toUpperCase())
  identificationType!: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  referrerId?: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(8)
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}
