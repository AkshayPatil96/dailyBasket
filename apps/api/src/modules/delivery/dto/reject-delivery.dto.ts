import { IsEnum, IsNotEmpty, IsString, MaxLength, ValidateIf } from 'class-validator';
import { DeliveryRejectionReason } from '@prisma/client';

export class RejectDeliveryDto {
  @IsEnum(DeliveryRejectionReason)
  reason!: DeliveryRejectionReason;

  // Required only when reason is OTHER — the enum alone says nothing in
  // that case, everywhere else it'd just duplicate the enum label. Not
  // @IsOptional() deliberately: that would skip validation whenever note is
  // undefined, including the OTHER case this exists to catch.
  @ValidateIf((dto: RejectDeliveryDto) => dto.reason === 'OTHER')
  @IsNotEmpty({ message: 'note is required when reason is OTHER' })
  @IsString()
  @MaxLength(500)
  note?: string;
}
