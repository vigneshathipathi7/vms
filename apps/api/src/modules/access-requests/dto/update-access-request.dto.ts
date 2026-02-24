import { IsEnum, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

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
   * Required only when action is APPROVE.
   */
  @ValidateIf((o) => o.action === UpdateAccessRequestAction.APPROVE)
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  initialPassword?: string;
}
