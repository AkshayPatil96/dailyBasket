import { Injectable } from '@nestjs/common';
import { CategoriesService } from '../categories/categories.service';
import { ProductsService } from '../products/products.service';

@Injectable()
export class HomeService {
  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly productsService: ProductsService,
  ) {}

  // Single round trip for the homepage — the doc's "shopping context" principle:
  // the frontend just renders sections, the server decides what's eligible.
  async getHomepage() {
    const [categories, popularProducts, featuredProducts, deals] =
      await Promise.all([
        this.categoriesService.tree(),
        this.productsService.popular(),
        this.productsService.featured(),
        this.productsService.deals(),
      ]);

    return {
      categories: categories.filter((category) => !category.parentId),
      popularProducts,
      featuredProducts,
      deals,
    };
  }
}
