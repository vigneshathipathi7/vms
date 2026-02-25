import {
  IsString,
  Matches,
  MaxLength,
  MinLength,
  IsOptional,
} from 'class-validator';

export class CreateVoterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @Matches(/^\d{10}$/, { message: 'contactNumber must be exactly 10 digits' })
  contactNumber!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9]+$/, { message: 'voterId must be alphanumeric' })
  voterId!: string;

  // Dynamic hierarchy fields - validated based on candidate's electionType
  // For PARLIAMENT elections
  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  constituency?: string;

  @IsOptional()
  @IsString()
  assemblyConstituency?: string;

  // For LOCAL_BODY elections (required), optional for others
  @IsOptional()
  @IsString()
  talukId?: string;

  @IsOptional()
  @IsString()
  villageId?: string;

  // Always required - ward/booth
  @IsString()
  wardId!: string;

  @IsString()
  @MaxLength(250)
  address!: string;

  @IsString()
  zoneId!: string;
}
