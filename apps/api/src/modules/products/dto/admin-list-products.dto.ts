import { IsEnum, IsOptional } from 'class-validator';
import { ProductStatus } from '@prisma/client';
import { ListProductsDto } from './list-products.dto';

export class AdminListProductsDto extends ListProductsDto {
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;
}
