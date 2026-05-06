// Integration test: load the page, listen for console errors, click through
// title -> creator -> begin, then drive the player to test movement.
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/local/bin/google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: 'new',
  });
  const page = await browser.newPage();
  const errors = [];
  const logs = [];
  page.on('pageerror', err => { errors.push('pageerror: ' + err.message); });
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push('console: ' + msg.text());
    logs.push('[' + msg.type() + '] ' + msg.text());
  });
  await page.goto('http://localhost:8000/index.html', { waitUntil: 'networkidle0' });

  // Wait for title screen
  await page.waitForSelector('#btn-new');
  await page.click('#btn-new');
  await page.waitForSelector('#cc-start');
  await page.click('#cc-start');

  // Give the game a moment to start
  await new Promise(r => setTimeout(r, 500));

  // Take a screenshot
  await page.screenshot({ path: 'test/screenshot-start.png' });

  // Press 's' (move down) for 1.5s
  await page.keyboard.down('KeyS');
  await new Promise(r => setTimeout(r, 1500));
  await page.keyboard.up('KeyS');
  await page.screenshot({ path: 'test/screenshot-moved.png' });

  // Try entering village by walking up to the path... already at center
  // Just open menu
  await page.keyboard.press('Tab');
  await new Promise(r => setTimeout(r, 200));
  await page.screenshot({ path: 'test/screenshot-menu.png' });
  await page.keyboard.press('Tab');

  await new Promise(r => setTimeout(r, 200));

  console.log('Errors:', errors.length);
  errors.forEach(e => console.log('  ', e));
  console.log('Logs (last 10):');
  logs.slice(-10).forEach(l => console.log('  ', l));

  await browser.close();
  process.exit(errors.length > 0 ? 1 : 0);
})();
