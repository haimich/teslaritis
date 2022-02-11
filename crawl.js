const puppeteer = require('puppeteer');
const fs  = require('fs');
const { execSync } = require('child_process');

async function loadPageContent() {
  const url = 'https://www.tesla.com/de_DE/modely/design?redirect=no';

  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  console.log("Opening " + url);

  await page.goto(url);

  await page.on('domcontentloaded');

  const extractedText = await page.$eval('*', (el) => el.innerText);
  
  console.log("Creating screenshot");

  await page.screenshot({ path: 'screenshot.png', fullPage: true });

  await browser.close();

  return extractedText;
}

function checkGitModifications() {
  execSync("git status", (error, stdout, stderr) => {
    if (error) {
        console.log(`error: ${error.message}`);
        return;
    }
    if (stderr) {
        console.log(`stderr: ${stderr}`);
        return;
    }
    console.log(`stdout: ${stdout}`);
  });
}

(async () => {
  console.log("Loading page content");

  const text = await loadPageContent();

  console.log()

  fs.writeFileSync('content.txt', text);
})();
