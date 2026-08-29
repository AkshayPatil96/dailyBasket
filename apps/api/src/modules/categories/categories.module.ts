import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UploadsModule } from '../uploads/uploads.module';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

@Module({
  imports: [JwtModule.register({}), UploadsModule],
  controllers: [CategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
