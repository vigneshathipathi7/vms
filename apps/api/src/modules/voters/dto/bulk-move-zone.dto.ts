import { ArrayMinSize, IsArray, IsString, MinLength } from 'class-validator';

export class BulkMoveZoneDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  voterIds!: string[];

  @IsString()
  targetZoneId!: string;
}
