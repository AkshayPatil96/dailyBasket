import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { TokenService } from './token.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { CartModule } from '../cart/cart.module';

@Module({
  imports: [JwtModule.register({}), NotificationsModule, CartModule],
  controllers: [AuthController],
  providers: [AuthService, SessionService, TokenService],
  exports: [AuthService],
})
export class AuthModule {}
