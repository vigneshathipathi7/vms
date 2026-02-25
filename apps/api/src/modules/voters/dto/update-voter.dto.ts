import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateVoterDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{10}$/, { message: 'contactNumber must be exactly 10 digits' })
  contactNumber?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9]+$/, { message: 'voterId must be alphanumeric' })
  voterId?: string;

  // Dynamic hierarchy fields
  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  constituency?: string;

  @IsOptional()
  @IsString()
  assemblyConstituency?: string;

  @IsOptional()
  @IsString()
  talukId?: string;

  @IsOptional()
  @IsString()
  villageId?: string;

  @IsOptional()
  @IsString()
  wardId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  address?: string;

  @IsOptional()
  @IsString()
  zoneId?: string;

  @IsOptional()
  @IsBoolean()
  voted?: boolean;
}
