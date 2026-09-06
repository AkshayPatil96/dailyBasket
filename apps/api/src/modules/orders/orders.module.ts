import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { OrdersController } from './orders.controller';
import { OrdersTrackController } from './orders-track.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [OrdersController, OrdersTrackController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
