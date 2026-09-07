import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CouponsModule } from '../coupons/coupons.module';
import { SettingsModule } from '../settings/settings.module';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';

@Module({
  imports: [JwtModule.register({}), CouponsModule, SettingsModule],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
