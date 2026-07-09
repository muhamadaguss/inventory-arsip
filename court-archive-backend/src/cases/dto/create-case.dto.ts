import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCaseDto {
  @IsString()
  @IsNotEmpty()
  caseNumberRaw: string;

  @IsOptional()
  @IsString()
  caseNumberClean?: string;

  @IsString()
  @IsNotEmpty()
  caseType: string;

  @IsInt()
  year: number;

  @IsString()
  @IsNotEmpty()
  partiesInvolved: string;

  @IsOptional()
  @IsInt()
  shelfId?: number;

  @IsOptional()
  @IsString()
  filePositionNumber?: string;
}
