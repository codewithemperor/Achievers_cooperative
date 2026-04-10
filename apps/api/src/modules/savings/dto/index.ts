import { IsNumber, Min } from 'class-validator';

export class ContributeSavingsDto {
  @IsNumber()
  @Min(100)
  amount!: number;
}
