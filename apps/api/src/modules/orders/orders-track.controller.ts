import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { OrdersService } from './orders.service';
import { TrackOrderDto } from './dto/track-order.dto';

// Deliberately a separate controller (not a route on OrdersController) so it
// never accidentally inherits that controller's @UseGuards(JwtAuthGuard) —
// this one is public by design. Rate-limited like the auth endpoints: the
// orderNumber format is sequential/guessable, so this pair is brute-forceable
// against a known email without a throttle.
@Controller('orders')
export class OrdersTrackController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('track')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async track(@Body() dto: TrackOrderDto) {
    return this.ordersService.trackOrder(dto.orderNumber, dto.email);
  }
}
