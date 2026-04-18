import { IsOptional, IsString } from 'class-validator';
import type { MemberStatus } from '../../../common/prisma-types';
import { Transform } from 'class-transformer';

export class UpdateMemberDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;
}

export class UpdateMemberStatusDto {
  @IsOptional()
  @Transform(({ value }) => value?.toUpperCase())
  status?: MemberStatus;
}

export class QueryMembersDto {
  @IsOptional()
  status?: MemberStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  page?: number = 1;

  @IsOptional()
  limit?: number = 20;
}
