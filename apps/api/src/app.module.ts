import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { RedisThrottlerStorageService } from './redis/redis-throttler-storage.service';
import { RealtimeModule } from './realtime/realtime.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProductsModule } from './modules/products/products.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { HomeModule } from './modules/home/home.module';
import { CartModule } from './modules/cart/cart.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { CheckoutModule } from './modules/checkout/checkout.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { CouponsModule } from './modules/coupons/coupons.module';
import { SettingsModule } from './modules/settings/settings.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { ProductViewsModule } from './modules/product-views/product-views.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AdminModule } from './modules/admin/admin.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisThrottlerStorageService],
      useFactory: (storage: RedisThrottlerStorageService) => ({
        throttlers: [{ ttl: 60_000, limit: 100 }],
        storage,
      }),
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    RealtimeModule,
    AuthModule,
    UsersModule,
    ProductsModule,
    CategoriesModule,
    HomeModule,
    CartModule,
    OrdersModule,
    PaymentsModule,
    CheckoutModule,
    InventoryModule,
    DeliveryModule,
    CouponsModule,
    SettingsModule,
    FavoritesModule,
    ProductViewsModule,
    NotificationsModule,
    AdminModule,
    UploadsModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
