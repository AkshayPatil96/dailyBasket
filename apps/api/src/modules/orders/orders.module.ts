import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsModule } from '../notifications/notifications.module';
import { CouponsModule } from '../coupons/coupons.module';
import { OrdersController } from './orders.controller';
import { OrdersTrackController } from './orders-track.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [JwtModule.register({}), NotificationsModule, CouponsModule],
  controllers: [OrdersController, OrdersTrackController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
