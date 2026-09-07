import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ResendModule } from 'nestjs-resend';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { EmailService } from './email.service';

@Module({
  imports: [
    JwtModule.register({}),
    ResendModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        // Resend's client throws at construction if no key is resolvable at all (including
        // via its own process.env.RESEND_API_KEY fallback) — a placeholder keeps the module
        // constructible when RESEND_API_KEY is unset. EmailService gates on the real key
        // before ever calling send(), so this placeholder is never actually used.
        apiKey:
          configService.get<string>('resend.apiKey') ?? 'placeholder-not-used',
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, EmailService],
  exports: [NotificationsService, EmailService],
})
export class NotificationsModule {}
