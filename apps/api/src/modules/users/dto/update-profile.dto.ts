import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ValidateIf((_, value) => value !== undefined && value !== '')
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  officeAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  electionLevel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  constituencyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  positionContesting?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  partyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  profilePhoto?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  bio?: string;

  @IsOptional()
  @IsString()
  managedVillageId?: string;

  @IsOptional()
  @IsString()
  managedWardId?: string;

  // For panchayat-level elections (ADMIN only - updates Candidate)
  @IsOptional()
  @IsString()
  talukId?: string;

  @IsOptional()
  @IsString()
  villageId?: string;
}
