import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

test.describe('ShopQA API Smoke Tests', () => {
  test('Health endpoint returns a healthy status', async ({
    request,
  }) => {
    const response = await request.get(`${BASE_URL}/api/health`);

    expect(response.status()).toBe(200);

    const body = await response.json();

    expect(body.status).toBe('ok');
    expect(body.service).toBe('ShopQA API');
    expect(body.timestamp).toBeTruthy();
  });

  test('Product catalogue returns valid products', async ({
    request,
  }) => {
    const response = await request.get(`${BASE_URL}/api/products`);

    expect(response.status()).toBe(200);

    const body = await response.json();

    expect(Array.isArray(body.products)).toBe(true);
    expect(body.products.length).toBeGreaterThan(0);
    expect(body.total).toBe(body.products.length);

    for (const product of body.products) {
      expect(product.id).toBeDefined();
      expect(typeof product.name).toBe('string');
      expect(typeof product.price).toBe('number');
    }
  });

  test('Cart rejects unauthenticated requests', async ({
    request,
  }) => {
    const response = await request.get(`${BASE_URL}/api/cart`);

    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.code).toBe('AUTH_REQUIRED');
  });

  test('Admin inventory rejects unauthenticated requests', async ({
    request,
  }) => {
    const response = await request.get(
      `${BASE_URL}/api/admin/products`
    );

    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.code).toBe('AUTH_REQUIRED');
  });
});