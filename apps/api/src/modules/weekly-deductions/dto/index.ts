import { IsNumber, Min } from 'class-validator';

export class PayWeeklyDeductionDto {
  @IsNumber()
  @Min(1)
  amount!: number;
}
