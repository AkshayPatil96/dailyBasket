import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
