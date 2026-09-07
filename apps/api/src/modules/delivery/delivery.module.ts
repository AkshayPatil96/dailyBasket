import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DeliveryController } from './delivery.controller';
import { DeliveryService } from './delivery.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [DeliveryController],
  providers: [DeliveryService],
  exports: [DeliveryService],
})
export class DeliveryModule {}
