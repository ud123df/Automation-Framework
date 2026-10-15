import { test, expect } from '@playwright/test';

const demoEmail = 'qa.demo@shopqa.test';
const demoPassword = 'ShopQA@123';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Account' }).click();
  await page.getByTestId('auth-email').fill(demoEmail);
  await page.getByTestId('auth-password').fill(demoPassword);
  await page.getByRole('button', { name: /sign in/i }).last().click();
  await expect(page.getByRole('button', { name: /QA/i })).toBeVisible();
}

test('storefront loads products and can search the catalogue', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/ShopQA/);
  await expect(page.getByTestId('product-grid')).toBeVisible();
  await expect(page.getByTestId('product-card').first()).toBeVisible();
  await page.getByRole('button', { name: 'Search products' }).click();
  await page.getByTestId('product-search').fill('headphones');
  await expect(page.getByText('Aero Wireless Headphones')).toBeVisible();
});

test('demo user can add an item to cart and change quantity', async ({ page }) => {
  await login(page);
  const firstProduct = page.getByTestId('product-card').first();
  await firstProduct.getByRole('button', { name: /add .* to bag/i }).click();
  await page.getByTestId('open-cart').click();
  await expect(page.locator('.drawer-item')).toHaveCount(2);
  await page.getByRole('button', { name: /increase .* quantity/i }).click();
  await expect(page.locator('.quantity-control span')).toHaveText('2');
});

test('invalid login displays a useful validation message', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Account' }).click();
  await page.getByTestId('auth-email').fill('not-a-user@example.test');
  await page.getByTestId('auth-password').fill('WrongPass123');
  await page.getByRole('button', { name: /sign in/i }).last().click();
  await expect(page.getByRole('alert')).toContainText(/invalid email or password/i);
});

test ('invalid password displays a validation message', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button', {name:'Account'}).click();
  await page.getByTestId('auth-email').fill(demoEmail);
  await page.getByTestId('auth-password').fill('wrongpass');
  await page.getByRole('button',{name: /sign in/i}).last().click();
  await expect(page.getByRole('alert')).toContainText(/invalid email or password/i);

});
