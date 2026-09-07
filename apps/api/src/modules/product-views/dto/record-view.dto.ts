import { IsUUID } from 'class-validator';

export class RecordViewDto {
  @IsUUID()
  productId!: string;
}
