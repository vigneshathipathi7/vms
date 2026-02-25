import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export enum UpdateAccessRequestAction {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

export class UpdateAccessRequestDto {
  @IsEnum(UpdateAccessRequestAction)
  action!: UpdateAccessRequestAction;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  adminNotes?: string;

  /**
   * Password for the new ADMIN user.
   * Optional. If omitted on approval, a password setup link will be generated.
   */
  @IsString()
  @IsOptional()
  @MinLength(8)
  @MaxLength(128)
  initialPassword?: string;
}
