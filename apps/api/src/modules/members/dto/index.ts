import { Transform } from 'class-transformer';
import { IsDateString, IsEmail, IsIn, IsOptional, IsString, Matches } from 'class-validator';
import {
  IDENTIFICATION_TYPE_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  MEMBER_STATUS_OPTIONS,
  NIGERIAN_PHONE_REGEX,
} from '../../../common/member.constants';
import type { IdentificationType, MaritalStatus, MemberStatus } from '../../../common/prisma-types';

export class CreateMemberDto {
  @IsEmail()
  email!: string;

  @IsString()
  fullName!: string;

  @IsString()
  @Matches(NIGERIAN_PHONE_REGEX, {
    message: 'Phone number must be 11 digits and start with 0',
  })
  phoneNumber!: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsString()
  homeAddress!: string;

  @IsString()
  stateOfOrigin!: string;

  @IsDateString()
  dateOfBirth!: string;

  @IsString()
  occupation!: string;

  @IsIn(MARITAL_STATUS_OPTIONS)
  @Transform(({ value }) => value?.toUpperCase())
  maritalStatus!: MaritalStatus;

  @IsString()
  identificationNumber!: string;

  @IsString()
  identificationPicture!: string;

  @IsIn(IDENTIFICATION_TYPE_OPTIONS)
  @Transform(({ value }) => value?.toUpperCase())
  identificationType!: IdentificationType;

  @IsOptional()
  @IsIn(MEMBER_STATUS_OPTIONS)
  @Transform(({ value }) => value?.toUpperCase())
  status?: MemberStatus;

  @IsOptional()
  @IsString()
  referrerId?: string;
}

export class UpdateMemberDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  @Matches(NIGERIAN_PHONE_REGEX, {
    message: 'Phone number must be 11 digits and start with 0',
  })
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  homeAddress?: string;

  @IsOptional()
  @IsString()
  stateOfOrigin?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  occupation?: string;

  @IsOptional()
  @IsIn(MARITAL_STATUS_OPTIONS)
  @Transform(({ value }) => value?.toUpperCase())
  maritalStatus?: MaritalStatus;

  @IsOptional()
  @IsString()
  identificationNumber?: string;

  @IsOptional()
  @IsString()
  identificationPicture?: string;

  @IsOptional()
  @IsIn(IDENTIFICATION_TYPE_OPTIONS)
  @Transform(({ value }) => value?.toUpperCase())
  identificationType?: IdentificationType;

  @IsOptional()
  @IsIn(MEMBER_STATUS_OPTIONS)
  @Transform(({ value }) => value?.toUpperCase())
  status?: MemberStatus;

  @IsOptional()
  @IsString()
  referrerId?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}

export class UpdateMemberStatusDto {
  @IsIn(MEMBER_STATUS_OPTIONS)
  @Transform(({ value }) => value?.toUpperCase())
  status!: MemberStatus;
}

export class QueryMembersDto {
  @IsOptional()
  @IsIn(MEMBER_STATUS_OPTIONS)
  @Transform(({ value }) => value?.toUpperCase())
  status?: MemberStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  page?: number = 1;

  @IsOptional()
  limit?: number = 20;
}
