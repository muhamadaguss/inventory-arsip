import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateShelfDto {
  @IsString()
  @IsNotEmpty()
  rackName: string;

  @IsInt()
  rowNumber: number;

  @IsOptional()
  @IsInt()
  slotNumber?: number;
}
