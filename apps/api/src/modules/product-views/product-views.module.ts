import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ProductViewsController } from './product-views.controller';
import { ProductViewsService } from './product-views.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [ProductViewsController],
  providers: [ProductViewsService],
})
export class ProductViewsModule {}
