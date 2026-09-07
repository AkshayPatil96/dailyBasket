import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { PaymentsModule } from '../payments/payments.module';
import { OrdersModule } from '../orders/orders.module';
import { CouponsModule } from '../coupons/coupons.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [JwtModule.register({}), PaymentsModule, OrdersModule, CouponsModule, SettingsModule],
  controllers: [CheckoutController],
  providers: [CheckoutService],
  exports: [CheckoutService],
})
export class CheckoutModule {}
