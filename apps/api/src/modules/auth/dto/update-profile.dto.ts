import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'firstName cannot be empty' })
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'lastName cannot be empty' })
  lastName?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
