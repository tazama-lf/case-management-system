import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class createFilterDto {
  @IsUUID()
  user_id: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  filterType: string;

  @IsString()
  @IsNotEmpty()
  userFilters: string;
}
