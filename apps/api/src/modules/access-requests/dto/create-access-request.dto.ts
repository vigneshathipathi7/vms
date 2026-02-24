import { IsArray, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ElectionType } from '@prisma/client';

export class CreateAccessRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phone!: string;

  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsEnum(ElectionType)
  @IsNotEmpty()
  electionType!: ElectionType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  contestingFor!: string;

  // Dynamic hierarchy fields - validated based on electionType
  // For PARLIAMENT elections
  @IsString()
  @IsOptional()
  @MaxLength(100)
  state?: string;

  // For LOCAL_BODY and ASSEMBLY elections
  @IsString()
  @IsOptional()
  @MaxLength(100)
  district?: string;

  // For ASSEMBLY (assembly constituency) or PARLIAMENT (parliamentary constituency)
  @IsString()
  @IsOptional()
  @MaxLength(100)
  constituency?: string;

  // For PARLIAMENT: assembly constituency within parliamentary constituency
  @IsString()
  @IsOptional()
  @MaxLength(100)
  assemblyConstituency?: string;

  // For LOCAL_BODY: taluk reference
  @IsString()
  @IsOptional()
  @MaxLength(100)
  taluk?: string;

  // Legacy field for backward compatibility
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  requestedTaluks?: string[];

  @IsString()
  @IsOptional()
  @MaxLength(100)
  partyName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  bio?: string;

  // CAPTCHA token for bot protection
  @IsString()
  @IsOptional()
  captchaToken?: string;
}
