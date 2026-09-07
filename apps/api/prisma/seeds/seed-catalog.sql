-- ============================================================================
-- DailyBasket seed data: categories (incl. nested), brands, products, variants,
-- inventory
-- ============================================================================
-- STATUS: already applied to the dev DB (2026-08-25). This file is kept as the
-- durable reference of what's live, and as a re-run template — safe to run
-- again against a fresh/empty DB, but re-running against a DB that already has
-- these rows will fail on unique constraints (slug, sku_code, barcode).
--
-- All ids are literal UUIDs — freely find/replace before re-running. None of
-- these tables reference a user id (Category/Brand/Product/ProductVariant/
-- Inventory have no user/created-by column in this schema); the admin user
-- used to apply this seed (33086592-864c-404f-b695-7cce0110f6cc,
-- aksh.patil2706@gmail.com) is not stored anywhere on these rows.
--
-- Images are intentionally NOT included — upload them through
-- /admin/categories, /admin/brands, /admin/products.
--
-- Run against the Neon DB, e.g.:
--   psql "$DIRECT_URL" -f apps/api/prisma/seeds/seed-catalog.sql
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Categories (12: 6 top-level + 6 nested)
-- ----------------------------------------------------------------------------
INSERT INTO "categories" ("id", "parent_id", "name", "slug", "description", "image_url", "sort_order", "status", "created_at", "updated_at") VALUES
  ('ef42aa46-a03a-454a-887d-04ddf169d149', NULL, 'Fruits & Vegetables', 'fruits-vegetables', 'Fresh produce, picked daily.', NULL, 0, 'ACTIVE', now(), now()),
  ('37ed3864-4e19-4ee5-afab-fdddc2ea474c', 'ef42aa46-a03a-454a-887d-04ddf169d149', 'Fresh Fruits', 'fresh-fruits', 'Seasonal fresh fruits.', NULL, 0, 'ACTIVE', now(), now()),
  ('19e41856-2f80-4124-89bb-2fe78aa8c13d', 'ef42aa46-a03a-454a-887d-04ddf169d149', 'Fresh Vegetables', 'fresh-vegetables', 'Farm-fresh vegetables.', NULL, 1, 'ACTIVE', now(), now()),
  ('18bae100-a582-432d-985b-d0a65a74beba', NULL, 'Dairy & Eggs', 'dairy-eggs', 'Milk, curd, butter, and farm-fresh eggs.', NULL, 1, 'ACTIVE', now(), now()),
  ('d24edfb8-4bd7-4fac-91fb-1ed0fa33fcde', '18bae100-a582-432d-985b-d0a65a74beba', 'Milk & Curd', 'milk-curd', 'Fresh milk and curd.', NULL, 0, 'ACTIVE', now(), now()),
  ('9c859ead-cd3b-46f2-b4ee-30be0d2cffa5', '18bae100-a582-432d-985b-d0a65a74beba', 'Butter & Cheese', 'butter-cheese', 'Butter, cheese, and spreads.', NULL, 1, 'ACTIVE', now(), now()),
  ('a87cd496-5a48-4918-bfc4-4ccd425cb6db', NULL, 'Bakery', 'bakery', 'Fresh bread, cookies, and baked goods.', NULL, 2, 'ACTIVE', now(), now()),
  ('67cdf24b-5166-41c9-a258-be03026a432c', NULL, 'Beverages', 'beverages', 'Tea, coffee, and juices.', NULL, 3, 'ACTIVE', now(), now()),
  ('a96a61a7-667b-4f6d-8843-a46d7d2ef8a6', NULL, 'Snacks & Munchies', 'snacks-munchies', 'Biscuits, namkeen, and chips.', NULL, 4, 'ACTIVE', now(), now()),
  ('bd2295c4-8af6-40c2-acec-0c3153b29b58', 'a96a61a7-667b-4f6d-8843-a46d7d2ef8a6', 'Biscuits & Cookies', 'biscuits-cookies', 'Sweet and savoury biscuits.', NULL, 0, 'ACTIVE', now(), now()),
  ('6b064963-2294-4446-bfbd-2b8914553cee', 'a96a61a7-667b-4f6d-8843-a46d7d2ef8a6', 'Namkeen & Chips', 'namkeen-chips', 'Namkeen, bhujia, and chips.', NULL, 1, 'ACTIVE', now(), now()),
  ('c418195b-fad5-48f5-b0fb-5f204f42fbad', NULL, 'Personal Care', 'personal-care', 'Everyday personal care essentials.', NULL, 5, 'ACTIVE', now(), now());

-- ----------------------------------------------------------------------------
-- Brands (10)
-- ----------------------------------------------------------------------------
INSERT INTO "brands" ("id", "name", "slug", "logo_url", "status", "created_at", "updated_at") VALUES
  ('96384056-f76c-4d84-a1f7-fe85dc601ea8', 'Amul', 'amul', NULL, 'ACTIVE', now(), now()),
  ('58a8aef2-4dfc-4450-8440-f0fd3d038f0c', 'Nestlé', 'nestle', NULL, 'ACTIVE', now(), now()),
  ('eaa82664-697f-487c-8f92-a17b3d79fed7', 'Britannia', 'britannia', NULL, 'ACTIVE', now(), now()),
  ('3478e756-03d9-4c0e-ad22-21c1b0b85083', 'Tata Consumer', 'tata-consumer', NULL, 'ACTIVE', now(), now()),
  ('1cae94b5-b992-4e7f-8283-d2a62290276d', 'ITC', 'itc', NULL, 'ACTIVE', now(), now()),
  ('604de001-5f49-45de-a0f6-9bf7add688f3', 'Parle', 'parle', NULL, 'ACTIVE', now(), now()),
  ('9962f1c0-8716-47f6-946e-f781be6e15e0', 'Haldiram''s', 'haldirams', NULL, 'ACTIVE', now(), now()),
  ('dc323444-baa8-4e4d-bd77-f63fc5e5dbaf', 'Patanjali', 'patanjali', NULL, 'ACTIVE', now(), now()),
  ('e967016d-7d74-4f0d-889a-5882ac6967ca', 'Mother Dairy', 'mother-dairy', NULL, 'ACTIVE', now(), now()),
  ('657ed53b-ae0e-4c09-9c3b-c533a9fd4b06', 'Dabur', 'dabur', NULL, 'ACTIVE', now(), now());

-- ----------------------------------------------------------------------------
-- Products (20)
-- ----------------------------------------------------------------------------
INSERT INTO "products" ("id", "category_id", "brand_id", "name", "slug", "description", "ingredients", "nutritional_info", "dietary_info", "country_of_origin", "status", "created_at", "updated_at") VALUES
  ('d7b074e3-5af5-433f-8a6e-9aaad62e64b8', '37ed3864-4e19-4ee5-afab-fdddc2ea474c', NULL, 'Fresh Bananas', 'fresh-bananas', NULL, NULL, NULL, ARRAY['VEGETARIAN']::"DietaryTag"[], 'India', 'ACTIVE', now(), now()),
  ('960667b4-4a06-4947-ae4b-775ac93e3478', '19e41856-2f80-4124-89bb-2fe78aa8c13d', NULL, 'Fresh Tomatoes', 'fresh-tomatoes', NULL, NULL, NULL, ARRAY['VEGETARIAN']::"DietaryTag"[], 'India', 'ACTIVE', now(), now()),
  ('abc2b19b-607f-4815-add5-28137244fa58', '19e41856-2f80-4124-89bb-2fe78aa8c13d', NULL, 'Red Onions', 'red-onions', NULL, NULL, NULL, ARRAY['VEGETARIAN']::"DietaryTag"[], 'India', 'ACTIVE', now(), now()),
  ('f249b473-cfda-48b6-8030-b7bf1719a062', '19e41856-2f80-4124-89bb-2fe78aa8c13d', NULL, 'Potatoes', 'potatoes', NULL, NULL, NULL, ARRAY['VEGETARIAN']::"DietaryTag"[], 'India', 'ACTIVE', now(), now()),
  ('0af9940a-16c0-467c-a9dc-61014ee12d05', 'd24edfb8-4bd7-4fac-91fb-1ed0fa33fcde', '96384056-f76c-4d84-a1f7-fe85dc601ea8', 'Amul Toned Milk', 'amul-toned-milk', NULL, NULL, NULL, ARRAY['VEGETARIAN']::"DietaryTag"[], 'India', 'ACTIVE', now(), now()),
  ('3114a45e-4928-4ee1-ac3d-972d6e9f57b0', '9c859ead-cd3b-46f2-b4ee-30be0d2cffa5', '96384056-f76c-4d84-a1f7-fe85dc601ea8', 'Amul Butter', 'amul-butter', NULL, NULL, NULL, ARRAY['VEGETARIAN']::"DietaryTag"[], 'India', 'ACTIVE', now(), now()),
  ('ac25bfee-3edd-4e17-8d7c-a17b7a721600', '18bae100-a582-432d-985b-d0a65a74beba', NULL, 'Farm Fresh Eggs', 'farm-fresh-eggs', NULL, NULL, NULL, ARRAY[]::"DietaryTag"[], 'India', 'ACTIVE', now(), now()),
  ('76a61f34-06ca-42af-b810-f60896167f4f', 'd24edfb8-4bd7-4fac-91fb-1ed0fa33fcde', 'e967016d-7d74-4f0d-889a-5882ac6967ca', 'Mother Dairy Curd', 'mother-dairy-curd', NULL, NULL, NULL, ARRAY['VEGETARIAN']::"DietaryTag"[], 'India', 'ACTIVE', now(), now()),
  ('f87cf311-e448-4551-827b-f98b9b4544e0', 'a87cd496-5a48-4918-bfc4-4ccd425cb6db', 'eaa82664-697f-487c-8f92-a17b3d79fed7', 'Britannia Brown Bread', 'britannia-brown-bread', NULL, NULL, NULL, ARRAY['VEGETARIAN']::"DietaryTag"[], 'India', 'ACTIVE', now(), now()),
  ('d4b5a37e-4834-420e-a38d-052f13b96283', 'a87cd496-5a48-4918-bfc4-4ccd425cb6db', 'eaa82664-697f-487c-8f92-a17b3d79fed7', 'Britannia Good Day Cookies', 'britannia-good-day-cookies', NULL, NULL, NULL, ARRAY['VEGETARIAN']::"DietaryTag"[], 'India', 'ACTIVE', now(), now()),
  ('aa2d86db-2069-4331-8148-b4e1fa1039a9', 'a87cd496-5a48-4918-bfc4-4ccd425cb6db', NULL, 'Butter Croissant', 'butter-croissant', NULL, NULL, NULL, ARRAY['VEGETARIAN']::"DietaryTag"[], 'India', 'ACTIVE', now(), now()),
  ('9812855e-639c-42ac-a8ec-3af57b157e1b', '67cdf24b-5166-41c9-a258-be03026a432c', '3478e756-03d9-4c0e-ad22-21c1b0b85083', 'Tata Tea Gold', 'tata-tea-gold', NULL, NULL, NULL, ARRAY['VEGETARIAN']::"DietaryTag"[], 'India', 'ACTIVE', now(), now()),
  ('1ebd6e29-129f-4d3b-8e7c-75a019784d86', '67cdf24b-5166-41c9-a258-be03026a432c', '58a8aef2-4dfc-4450-8440-f0fd3d038f0c', 'Nescafé Classic Coffee', 'nescafe-classic-coffee', NULL, NULL, NULL, ARRAY['VEGETARIAN']::"DietaryTag"[], 'India', 'ACTIVE', now(), now()),
  ('0bb9091f-7a03-4135-b461-4cd23ed9ea34', '67cdf24b-5166-41c9-a258-be03026a432c', '657ed53b-ae0e-4c09-9c3b-c533a9fd4b06', 'Dabur Real Mixed Fruit Juice', 'dabur-real-mixed-fruit-juice', NULL, NULL, NULL, ARRAY['VEGETARIAN']::"DietaryTag"[], 'India', 'ACTIVE', now(), now()),
  ('4ac9599d-0ce1-4917-bffb-14a6ce470918', 'bd2295c4-8af6-40c2-acec-0c3153b29b58', '604de001-5f49-45de-a0f6-9bf7add688f3', 'Parle-G Biscuits', 'parle-g-biscuits', NULL, NULL, NULL, ARRAY['VEGETARIAN']::"DietaryTag"[], 'India', 'ACTIVE', now(), now()),
  ('11de5be6-cf12-4ac2-9b67-c0502ccb91c8', '6b064963-2294-4446-bfbd-2b8914553cee', '9962f1c0-8716-47f6-946e-f781be6e15e0', 'Haldiram''s Aloo Bhujia', 'haldirams-aloo-bhujia', NULL, NULL, NULL, ARRAY['VEGETARIAN']::"DietaryTag"[], 'India', 'ACTIVE', now(), now()),
  ('fd692d79-1ecb-410b-ba0e-38a2b78f4c78', '6b064963-2294-4446-bfbd-2b8914553cee', '1cae94b5-b992-4e7f-8283-d2a62290276d', 'ITC Bingo Mad Angles', 'itc-bingo-mad-angles', NULL, NULL, NULL, ARRAY['VEGETARIAN']::"DietaryTag"[], 'India', 'ACTIVE', now(), now()),
  ('76033c91-ae77-4730-aaf5-0be77c6853de', 'bd2295c4-8af6-40c2-acec-0c3153b29b58', 'eaa82664-697f-487c-8f92-a17b3d79fed7', 'Britannia Marie Gold', 'britannia-marie-gold', NULL, NULL, NULL, ARRAY['VEGETARIAN']::"DietaryTag"[], 'India', 'ACTIVE', now(), now()),
  ('2e310f42-7a16-4684-839d-ead9f5a5d608', 'c418195b-fad5-48f5-b0fb-5f204f42fbad', 'dc323444-baa8-4e4d-bd77-f63fc5e5dbaf', 'Patanjali Aloe Vera Gel', 'patanjali-aloe-vera-gel', NULL, NULL, NULL, ARRAY[]::"DietaryTag"[], 'India', 'ACTIVE', now(), now()),
  ('ace03830-496c-4cf6-8252-163224eb7adb', 'c418195b-fad5-48f5-b0fb-5f204f42fbad', '657ed53b-ae0e-4c09-9c3b-c533a9fd4b06', 'Dabur Red Toothpaste', 'dabur-red-toothpaste', NULL, NULL, NULL, ARRAY[]::"DietaryTag"[], 'India', 'ACTIVE', now(), now());

-- ----------------------------------------------------------------------------
-- Product variants (20) — one per product
-- ----------------------------------------------------------------------------
INSERT INTO "product_variants" ("id", "product_id", "sku_code", "barcode", "label", "quantity", "unit", "price", "compare_at_price", "status", "created_at", "updated_at") VALUES
  ('1a7f5238-7897-4695-9dbf-8f3b3c06689d', 'd7b074e3-5af5-433f-8a6e-9aaad62e64b8', 'FNV-BANANA-1KG', NULL, '1 kg', 1, 'KG', 40.00, NULL, 'ACTIVE', now(), now()),
  ('1cc4d612-bd7a-4305-b17e-7ab56e5aae3b', '960667b4-4a06-4947-ae4b-775ac93e3478', 'FNV-TOMATO-1KG', NULL, '1 kg', 1, 'KG', 35.00, NULL, 'ACTIVE', now(), now()),
  ('3b4426f2-8c07-4437-8dec-5acfcfca7a36', 'abc2b19b-607f-4815-add5-28137244fa58', 'FNV-ONION-1KG', NULL, '1 kg', 1, 'KG', 30.00, NULL, 'ACTIVE', now(), now()),
  ('316f6d28-390c-440f-87d1-c4587e2514a0', 'f249b473-cfda-48b6-8030-b7bf1719a062', 'FNV-POTATO-1KG', NULL, '1 kg', 1, 'KG', 28.00, NULL, 'ACTIVE', now(), now()),
  ('2b823cdf-1ee0-4dfb-9062-efa1ec2e0e28', '0af9940a-16c0-467c-a9dc-61014ee12d05', 'DAIRY-AMULMILK-500ML', NULL, '500 ml', 500, 'ML', 27.00, NULL, 'ACTIVE', now(), now()),
  ('45a01336-5fff-4c6c-9511-8f4ed446001c', '3114a45e-4928-4ee1-ac3d-972d6e9f57b0', 'DAIRY-AMULBUTTER-100G', NULL, '100 g', 100, 'G', 55.00, NULL, 'ACTIVE', now(), now()),
  ('d04a3805-9311-4b9a-8acb-f41f8fcc5f01', 'ac25bfee-3edd-4e17-8d7c-a17b7a721600', 'DAIRY-EGGS-6PK', NULL, '6 pieces', 6, 'PIECE', 42.00, NULL, 'ACTIVE', now(), now()),
  ('c0cef39b-b854-44c3-8278-5045839cdb27', '76a61f34-06ca-42af-b810-f60896167f4f', 'DAIRY-MDCURD-400G', NULL, '400 g', 400, 'G', 35.00, NULL, 'ACTIVE', now(), now()),
  ('df6f845f-c096-4633-8f90-e0f3f4f64ea7', 'f87cf311-e448-4551-827b-f98b9b4544e0', 'BAKERY-BRITBREAD-400G', NULL, '400 g', 400, 'G', 45.00, NULL, 'ACTIVE', now(), now()),
  ('a7fe52f0-a5f0-418d-89a8-011949dc384e', 'd4b5a37e-4834-420e-a38d-052f13b96283', 'BAKERY-GOODDAY-200G', NULL, '200 g', 200, 'G', 30.00, 35.00, 'ACTIVE', now(), now()),
  ('6ab4e639-bfae-4683-a729-5c343523d271', 'aa2d86db-2069-4331-8148-b4e1fa1039a9', 'BAKERY-CROISSANT-4PK', NULL, '4 pieces', 4, 'PIECE', 90.00, NULL, 'ACTIVE', now(), now()),
  ('97b189f9-da5a-4ee9-b6b8-9781d12bb46b', '9812855e-639c-42ac-a8ec-3af57b157e1b', 'BEV-TATATEA-250G', NULL, '250 g', 250, 'G', 140.00, NULL, 'ACTIVE', now(), now()),
  ('822f9158-03b7-474c-9307-b6de96746f29', '1ebd6e29-129f-4d3b-8e7c-75a019784d86', 'BEV-NESCAFE-50G', NULL, '50 g', 50, 'G', 165.00, 180.00, 'ACTIVE', now(), now()),
  ('8ba08dd7-046a-4d21-852f-07419bd8b256', '0bb9091f-7a03-4135-b461-4cd23ed9ea34', 'BEV-DABURREAL-1L', NULL, '1 L', 1, 'L', 110.00, NULL, 'ACTIVE', now(), now()),
  ('a8a888f1-cfd4-44cc-bbca-a277d3b16feb', '4ac9599d-0ce1-4917-bffb-14a6ce470918', 'SNACK-PARLEG-800G', NULL, '800 g', 800, 'G', 65.00, NULL, 'ACTIVE', now(), now()),
  ('5a85a2cf-b51c-4111-a9f0-b4aeb694c346', '11de5be6-cf12-4ac2-9b67-c0502ccb91c8', 'SNACK-BHUJIA-200G', NULL, '200 g', 200, 'G', 55.00, NULL, 'ACTIVE', now(), now()),
  ('d6770607-524f-4d18-a2b4-2db86a21e683', 'fd692d79-1ecb-410b-ba0e-38a2b78f4c78', 'SNACK-BINGO-72G', NULL, '72 g', 72, 'G', 20.00, NULL, 'ACTIVE', now(), now()),
  ('787f911a-41ce-4bf9-b482-fa04d0147012', '76033c91-ae77-4730-aaf5-0be77c6853de', 'SNACK-MARIEGOLD-250G', NULL, '250 g', 250, 'G', 35.00, 40.00, 'ACTIVE', now(), now()),
  ('b1aa85d7-a939-4927-8a63-19995874d135', '2e310f42-7a16-4684-839d-ead9f5a5d608', 'PCARE-ALOEGEL-150ML', NULL, '150 ml', 150, 'ML', 85.00, NULL, 'ACTIVE', now(), now()),
  ('44c5445b-930b-44a9-abe0-32f01ab21d26', 'ace03830-496c-4cf6-8252-163224eb7adb', 'PCARE-DABURRED-200G', NULL, '200 g', 200, 'G', 95.00, 110.00, 'ACTIVE', now(), now());

-- ----------------------------------------------------------------------------
-- Inventory (20) — stock seeded to 100 units each, adjust as needed
-- ----------------------------------------------------------------------------
INSERT INTO "inventory" ("id", "variant_id", "quantity", "reserved_quantity", "reorder_level", "created_at", "updated_at") VALUES
  ('6f36bddf-0459-46bc-9965-b15aa0f0ae51', '1a7f5238-7897-4695-9dbf-8f3b3c06689d', 100, 0, 10, now(), now()),
  ('2d88c93c-18c3-40bd-84f2-4cda46959c4f', '1cc4d612-bd7a-4305-b17e-7ab56e5aae3b', 100, 0, 10, now(), now()),
  ('8c4d7810-54ea-454e-bf3d-4e248785749d', '3b4426f2-8c07-4437-8dec-5acfcfca7a36', 100, 0, 10, now(), now()),
  ('eb5a4cb5-747e-4d46-89eb-e6360925abfc', '316f6d28-390c-440f-87d1-c4587e2514a0', 100, 0, 10, now(), now()),
  ('5f514d7b-fe9b-474a-b863-2728efc5eb7e', '2b823cdf-1ee0-4dfb-9062-efa1ec2e0e28', 100, 0, 10, now(), now()),
  ('1804489e-becb-4f5e-b4fb-40963415aabd', '45a01336-5fff-4c6c-9511-8f4ed446001c', 100, 0, 10, now(), now()),
  ('85e63200-62ec-455b-8f88-691d747c7160', 'd04a3805-9311-4b9a-8acb-f41f8fcc5f01', 100, 0, 10, now(), now()),
  ('ce8e5e05-06c8-4cd1-92a4-daee349f5873', 'c0cef39b-b854-44c3-8278-5045839cdb27', 100, 0, 10, now(), now()),
  ('08fa88f5-53e5-4846-8f84-ea3289253103', 'df6f845f-c096-4633-8f90-e0f3f4f64ea7', 100, 0, 10, now(), now()),
  ('70ae8c70-02c2-494c-9ce5-2a68735c6dfe', 'a7fe52f0-a5f0-418d-89a8-011949dc384e', 100, 0, 10, now(), now()),
  ('569a4dcf-b612-47e5-a9d6-fdee5b9ecab8', '6ab4e639-bfae-4683-a729-5c343523d271', 100, 0, 10, now(), now()),
  ('6b2455f4-796b-4e49-ab24-71385911df45', '97b189f9-da5a-4ee9-b6b8-9781d12bb46b', 100, 0, 10, now(), now()),
  ('c155ebd5-79b1-4111-a569-be93557c2027', '822f9158-03b7-474c-9307-b6de96746f29', 100, 0, 10, now(), now()),
  ('91a118e1-cf0d-49a9-a935-21d4cbff5637', '8ba08dd7-046a-4d21-852f-07419bd8b256', 100, 0, 10, now(), now()),
  ('03f29c67-dd35-4fcb-b440-8d4f944832e5', 'a8a888f1-cfd4-44cc-bbca-a277d3b16feb', 100, 0, 10, now(), now()),
  ('2a9c372f-3727-4e22-b794-58900daf52b0', '5a85a2cf-b51c-4111-a9f0-b4aeb694c346', 100, 0, 10, now(), now()),
  ('0a5955a4-7b2a-4651-b0f4-872e84a8b8e5', 'd6770607-524f-4d18-a2b4-2db86a21e683', 100, 0, 10, now(), now()),
  ('a8d5b0bd-bbba-4480-a975-fc16e83b4748', '787f911a-41ce-4bf9-b482-fa04d0147012', 100, 0, 10, now(), now()),
  ('c5737693-579f-4af2-9cc5-5f133ddf706a', 'b1aa85d7-a939-4927-8a63-19995874d135', 100, 0, 10, now(), now()),
  ('70685baf-0bec-4438-ae8d-d98425ba83f4', '44c5445b-930b-44a9-abe0-32f01ab21d26', 100, 0, 10, now(), now());

COMMIT;

-- ============================================================================
-- Reference: slug -> id
-- ============================================================================
-- Categories:
--   fruits-vegetables        ef42aa46-a03a-454a-887d-04ddf169d149
--     fresh-fruits             37ed3864-4e19-4ee5-afab-fdddc2ea474c  (child of fruits-vegetables)
--     fresh-vegetables         19e41856-2f80-4124-89bb-2fe78aa8c13d  (child of fruits-vegetables)
--   dairy-eggs               18bae100-a582-432d-985b-d0a65a74beba
--     milk-curd                d24edfb8-4bd7-4fac-91fb-1ed0fa33fcde  (child of dairy-eggs)
--     butter-cheese            9c859ead-cd3b-46f2-b4ee-30be0d2cffa5  (child of dairy-eggs)
--   bakery                   a87cd496-5a48-4918-bfc4-4ccd425cb6db
--   beverages                67cdf24b-5166-41c9-a258-be03026a432c
--   snacks-munchies          a96a61a7-667b-4f6d-8843-a46d7d2ef8a6
--     biscuits-cookies         bd2295c4-8af6-40c2-acec-0c3153b29b58  (child of snacks-munchies)
--     namkeen-chips            6b064963-2294-4446-bfbd-2b8914553cee  (child of snacks-munchies)
--   personal-care            c418195b-fad5-48f5-b0fb-5f204f42fbad
-- Brands:
--   amul                     96384056-f76c-4d84-a1f7-fe85dc601ea8
--   nestle                   58a8aef2-4dfc-4450-8440-f0fd3d038f0c
--   britannia                eaa82664-697f-487c-8f92-a17b3d79fed7
--   tata-consumer            3478e756-03d9-4c0e-ad22-21c1b0b85083
--   itc                      1cae94b5-b992-4e7f-8283-d2a62290276d
--   parle                    604de001-5f49-45de-a0f6-9bf7add688f3
--   haldirams                9962f1c0-8716-47f6-946e-f781be6e15e0
--   patanjali                dc323444-baa8-4e4d-bd77-f63fc5e5dbaf
--   mother-dairy             e967016d-7d74-4f0d-889a-5882ac6967ca
--   dabur                    657ed53b-ae0e-4c09-9c3b-c533a9fd4b06
-- Products:
--   fresh-bananas                  d7b074e3-5af5-433f-8a6e-9aaad62e64b8  [fresh-fruits]
--   fresh-tomatoes                 960667b4-4a06-4947-ae4b-775ac93e3478  [fresh-vegetables]
--   red-onions                     abc2b19b-607f-4815-add5-28137244fa58  [fresh-vegetables]
--   potatoes                       f249b473-cfda-48b6-8030-b7bf1719a062  [fresh-vegetables]
--   amul-toned-milk                0af9940a-16c0-467c-a9dc-61014ee12d05  [milk-curd]
--   amul-butter                    3114a45e-4928-4ee1-ac3d-972d6e9f57b0  [butter-cheese]
--   farm-fresh-eggs                ac25bfee-3edd-4e17-8d7c-a17b7a721600  [dairy-eggs]
--   mother-dairy-curd              76a61f34-06ca-42af-b810-f60896167f4f  [milk-curd]
--   britannia-brown-bread          f87cf311-e448-4551-827b-f98b9b4544e0  [bakery]
--   britannia-good-day-cookies     d4b5a37e-4834-420e-a38d-052f13b96283  [bakery]
--   butter-croissant               aa2d86db-2069-4331-8148-b4e1fa1039a9  [bakery]
--   tata-tea-gold                  9812855e-639c-42ac-a8ec-3af57b157e1b  [beverages]
--   nescafe-classic-coffee         1ebd6e29-129f-4d3b-8e7c-75a019784d86  [beverages]
--   dabur-real-mixed-fruit-juice   0bb9091f-7a03-4135-b461-4cd23ed9ea34  [beverages]
--   parle-g-biscuits               4ac9599d-0ce1-4917-bffb-14a6ce470918  [biscuits-cookies]
--   haldirams-aloo-bhujia          11de5be6-cf12-4ac2-9b67-c0502ccb91c8  [namkeen-chips]
--   itc-bingo-mad-angles           fd692d79-1ecb-410b-ba0e-38a2b78f4c78  [namkeen-chips]
--   britannia-marie-gold           76033c91-ae77-4730-aaf5-0be77c6853de  [biscuits-cookies]
--   patanjali-aloe-vera-gel        2e310f42-7a16-4684-839d-ead9f5a5d608  [personal-care]
--   dabur-red-toothpaste           ace03830-496c-4cf6-8252-163224eb7adb  [personal-care]
