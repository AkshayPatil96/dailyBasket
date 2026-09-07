import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { OrdersModule } from '../orders/orders.module';
import { DeliveryPartnersModule } from '../delivery-partners/delivery-partners.module';
import { DeliveryController } from './delivery.controller';
import { DeliveryService } from './delivery.service';

@Module({
  imports: [JwtModule.register({}), OrdersModule, DeliveryPartnersModule],
  controllers: [DeliveryController],
  providers: [DeliveryService],
  exports: [DeliveryService],
})
export class DeliveryModule {}
