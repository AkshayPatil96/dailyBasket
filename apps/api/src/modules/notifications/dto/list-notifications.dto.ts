import { IsInt, IsOptional, Min } from 'class-validator';

export class ListNotificationsDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}
