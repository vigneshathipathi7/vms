import { IsString, MaxLength, MinLength } from 'class-validator';

export class SetupPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
