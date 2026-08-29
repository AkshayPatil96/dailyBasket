import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { CategoriesService } from '../categories/categories.service';
import { ProductsService } from '../products/products.service';

// Caps how much a single nightly run touches — a slow run just picks up the
// remainder tomorrow, rather than one cron tick trying to purge everything at once.
const MAX_PER_RUN = 200;

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly categoriesService: CategoriesService,
    private readonly productsService: ProductsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async purgeExpiredVisitorData(): Promise<void> {
    const ttlDays = this.configService.get<number>('app.visitorDataTtlDays') ?? 30;
    const cutoff = new Date(Date.now() - ttlDays * 24 * 60 * 60 * 1000);

    const products = await this.purgeExpiredProducts(cutoff);
    const categories = await this.purgeExpiredEmptyCategories(cutoff);
    const users = await this.purgeExpiredUsers(cutoff);

    if (products || categories || users) {
      this.logger.log(
        `Visitor-data cleanup: ${products} product(s), ${categories} category(ies), ${users} user(s) purged (older than ${ttlDays}d)`,
      );
    }
  }

  // Any product a visitor added (isSystem: false) — never touches seed catalog data.
  private async purgeExpiredProducts(cutoff: Date): Promise<number> {
    const expired = await this.prisma.product.findMany({
      where: { isSystem: false, createdAt: { lt: cutoff } },
      select: { id: true },
      take: MAX_PER_RUN,
    });

    let deleted = 0;
    for (const product of expired) {
      try {
        // Role only matters for the isSystem check inside remove() — the WHERE
        // clause above already filters to isSystem: false rows, so any non-SUPER_ADMIN
        // role here is equivalent.
        await this.productsService.remove(product.id, 'ADMIN');
        deleted++;
      } catch (error) {
        // Real order history (or a concurrent delete) — leave it, don't abort the batch.
        this.logger.warn(`Skipped product ${product.id} during cleanup: ${error}`);
      }
    }
    return deleted;
  }

  // Only sweeps EMPTY leaf categories (no children, no products) — a category
  // still holding visitor data is left for a later run once its contents clear,
  // which also guarantees this never reaches an isSystem:true row transitively.
  private async purgeExpiredEmptyCategories(cutoff: Date): Promise<number> {
    const expired = await this.prisma.category.findMany({
      where: {
        isSystem: false,
        createdAt: { lt: cutoff },
        children: { none: {} },
        products: { none: {} },
      },
      select: { id: true },
      take: MAX_PER_RUN,
    });

    let deleted = 0;
    for (const category of expired) {
      try {
        // Same reasoning as purgeExpiredProducts — role only matters for the
        // isSystem check, and the WHERE clause above already guarantees isSystem: false.
        await this.categoriesService.remove(category.id, 'ADMIN');
        deleted++;
      } catch (error) {
        this.logger.warn(`Skipped category ${category.id} during cleanup: ${error}`);
      }
    }
    return deleted;
  }

  // Any self-registered account (isSystem: false) — demo login accounts are
  // seeded with isSystem: true and are never eligible here.
  private async purgeExpiredUsers(cutoff: Date): Promise<number> {
    const expired = await this.prisma.user.findMany({
      where: { isSystem: false, createdAt: { lt: cutoff } },
      select: { id: true },
      take: MAX_PER_RUN,
    });

    let deleted = 0;
    for (const user of expired) {
      try {
        await this.prisma.$transaction([
          this.prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } }),
          this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
          this.prisma.address.deleteMany({ where: { userId: user.id } }),
          this.prisma.user.delete({ where: { id: user.id } }),
        ]);
        deleted++;
      } catch (error) {
        // Real order history (ON DELETE RESTRICT) — leave the account, don't abort the batch.
        this.logger.warn(`Skipped user ${user.id} during cleanup: ${error}`);
      }
    }
    return deleted;
  }
}
