import { ArrayMinSize, IsArray, IsString, MinLength } from 'class-validator';

export class BulkDeleteDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  voterIds!: string[];
}
