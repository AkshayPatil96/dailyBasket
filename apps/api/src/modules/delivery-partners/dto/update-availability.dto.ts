import { IsIn } from 'class-validator';

// Partner can only toggle OFFLINE<->AVAILABLE themselves — BUSY is
// system-set the moment they accept a delivery (see DeliveryPartner model
// comment), never a value they can set directly.
export class UpdateAvailabilityDto {
  @IsIn(['OFFLINE', 'AVAILABLE'])
  availability!: 'OFFLINE' | 'AVAILABLE';
}
