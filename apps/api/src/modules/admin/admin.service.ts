import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { CategoriesService } from '../categories/categories.service';
import { ProductsService } from '../products/products.service';
import { CheckoutService } from '../checkout/checkout.service';

// Caps how much a single nightly run touches — a slow run just picks up the
// remainder tomorrow, rather than one cron tick trying to purge everything at once.
const MAX_PER_RUN = 200;

// Cart expiry is a database-hygiene mechanism, not an inventory-reservation
// one (see main-docs/dailybasket-cart-architecture.md §20) — unrelated to
// the visitor-data isSystem TTL above, so it isn't config-driven either.
const CART_TTL_DAYS = 60;

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly categoriesService: CategoriesService,
    private readonly productsService: ProductsService,
    private readonly checkoutService: CheckoutService,
  ) {}

  // Runs every minute, far more often than the daily visitor-data sweep above —
  // the checkout doc's ~10 min reservation TTL means stale-held stock must
  // free up quickly, not once a day. "Never depend on the browser to release
  // inventory" (checkout doc §Reservation Expiry) is exactly what this guards.
  @Cron(CronExpression.EVERY_MINUTE)
  async expireCheckoutReservationsAndSessions(): Promise<void> {
    const now = new Date();

    const expiredReservations = await this.prisma.checkoutSession.findMany({
      where: { status: 'AWAITING_PAYMENT', reservationExpiresAt: { lt: now } },
      select: { id: true },
      take: MAX_PER_RUN,
    });
    for (const session of expiredReservations) {
      try {
        await this.checkoutService.releaseReservations(session.id);
        await this.prisma.checkoutSession.update({
          where: { id: session.id },
          data: { status: 'PENDING' },
        });
      } catch (error) {
        this.logger.warn(`Failed releasing expired reservation for checkout ${session.id}: ${error}`);
      }
    }

    const expiredSessions = await this.prisma.checkoutSession.findMany({
      where: { status: { in: ['PENDING', 'AWAITING_PAYMENT'] }, expiresAt: { lt: now } },
      select: { id: true },
      take: MAX_PER_RUN,
    });
    for (const session of expiredSessions) {
      try {
        // No-op if the reservation sweep above already released it this same tick.
        await this.checkoutService.releaseReservations(session.id);
        await this.prisma.checkoutSession.update({
          where: { id: session.id },
          data: { status: 'EXPIRED' },
        });
      } catch (error) {
        this.logger.warn(`Failed expiring checkout session ${session.id}: ${error}`);
      }
    }
  }

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

    const carts = await this.purgeAbandonedCarts();
    if (carts) {
      this.logger.log(`Cart cleanup: ${carts} abandoned cart(s) purged (older than ${CART_TTL_DAYS}d)`);
    }
  }

  // Abandoned carts (guest or authenticated) with no activity in CART_TTL_DAYS —
  // most carts are guest carts nobody ever returns to redeem via the cookie.
  private async purgeAbandonedCarts(): Promise<number> {
    const cutoff = new Date(Date.now() - CART_TTL_DAYS * 24 * 60 * 60 * 1000);
    const expired = await this.prisma.cart.findMany({
      where: {
        status: 'ACTIVE',
        OR: [{ updatedAt: { lt: cutoff } }, { updatedAt: null, createdAt: { lt: cutoff } }],
      },
      select: { id: true },
      take: MAX_PER_RUN,
    });

    let deleted = 0;
    for (const cart of expired) {
      try {
        await this.prisma.$transaction([
          this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } }),
          this.prisma.cart.delete({ where: { id: cart.id } }),
        ]);
        deleted++;
      } catch (error) {
        this.logger.warn(`Skipped cart ${cart.id} during cleanup: ${error}`);
      }
    }
    return deleted;
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
