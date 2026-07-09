import { IsIn } from 'class-validator';

export class UpdateCaseStatusDto {
  @IsIn(['Available', 'Borrowed'])
  status: 'Available' | 'Borrowed';
}
