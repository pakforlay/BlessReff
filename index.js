const puppeteer = require('puppeteer');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Fungsi untuk menyimpan email dan B7S_AUTH_TOKEN ke file .txt
function saveAuthToken(email, token) {
    const filePath = path.join(process.cwd(), 'auth_tokens.txt');
    const data = `EMAIL: ${email}\nB7S_AUTH_TOKEN: ${token}\n\n`;

    fs.appendFileSync(filePath, data, 'utf8', (err) => {
        if (err) {
            console.error('\nError saving auth token:', err);
        } else {
            console.log('\nAuth token saved successfully.');
        }
    });
}

// Fungsi untuk memproses satu email dan mendapatkan token
async function processEmail(baseEmail, index, refCode) {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    try {
        const generatedEmail = `${baseEmail.split('@')[0]}+${index}@${baseEmail.split('@')[1]}`;
        console.log(`\n==============================================`);
        console.log(`Processing Email: ${generatedEmail}`);

        await page.goto(`https://bless.network/dashboard/login?ref=${refCode}`, { waitUntil: 'networkidle2' });

        // Tunggu hingga elemen input email tersedia
        await page.waitForSelector('#email', { visible: true });

        // Memasukkan email dengan sedikit penundaan
        await page.type('#email', generatedEmail, { delay: 100 });

        // Tunggu hingga tombol login tersedia
        await page.waitForSelector('body > div > main > div > div > div.flex.flex-col > div.grid.gap-4 > button', { visible: true });

        // Klik tombol login
        await page.click('body > div > main > div > div > div.flex.flex-col > div.grid.gap-4 > button');

        console.log('Clicked login button');

        // Tangani pop-up yang membuka browser baru
        const [popup] = await Promise.all([
            new Promise(resolve => browser.once('targetcreated', async target => {
                const newPage = await target.page();
                resolve(newPage);
            })),
            new Promise(resolve => setTimeout(resolve, 5000)) // Beri waktu untuk pop-up terbuka
        ]);

        await popup.bringToFront();

        // Tunggu hingga elemen input OTP pada pop-up tersedia
        await popup.waitForSelector('#app > div > div > div > div > div:nth-child(4) > div > form > input:nth-child(1)', { visible: true });

        const otp = await new Promise(resolve => {
            rl.question('Please enter the OTP: ', resolve);
        });

        const otpArray = otp.split('');
        if (otpArray.length !== 6) {
            console.error('\nInvalid OTP length');
            await browser.close();
            return false;
        }

        // Masukkan setiap digit OTP ke dalam input yang sesuai menggunakan selector HTML
        for (let i = 0; i < 6; i++) {
            const inputSelector = `#app > div > div > div > div > div:nth-child(4) > div > form > input:nth-child(${i + 1})`;
            await popup.type(inputSelector, otpArray[i], { delay: 100 });
        }

        console.log('\nOTP entered successfully');

        // Tunggu hingga navigasi selesai
        await page.waitForNavigation({ waitUntil: 'networkidle2' });

        // Dapatkan nilai B7S_AUTH_TOKEN dari local storage atau session storage di halaman dashboard
        const authToken = await page.evaluate(() => {
            return localStorage.getItem('B7S_AUTH_TOKEN') || sessionStorage.getItem('B7S_AUTH_TOKEN');
        });

        console.log('\nB7S_AUTH_TOKEN:', authToken);
        console.log(`\nBerhasil mendaftarkan akun dengan email ${generatedEmail}`);

        // Simpan email dan B7S_AUTH_TOKEN ke file .txt
        saveAuthToken(generatedEmail, authToken);

        await browser.close();
        return true;

    } catch (error) {
        console.error('Error during login:', error);
        await browser.close();
        return false;
    }
}

// Fungsi untuk memulai proses batch email
async function startBatch(email, count, startFrom, refCode) {
    for (let i = startFrom; i < startFrom + count; i++) {
        const success = await processEmail(email, i, refCode);
        if (!success) {
            console.error(`Failed to process email: ${email.split('@')[0]}+${i}@${email.split('@')[1]}`);
            break;
        }
    }
    rl.close();
}

console.log('\nBless Network Semi Automation Register and Save Auth Token\n')
console.log('by PakForlay AKA @potaldogg\n')
rl.question('Masukkan kode referral (kosongkan jika tidak ada): ', (refCode) => {
    if (!refCode) {
        rl.question('Masukkan email anda: ', (email) => {
            rl.question('Berapa banyak email yang ingin anda buat: ', (count) => {
                rl.question('Mulai dari angka berapa email akan di-generate: ', (startFrom) => {
                    startBatch(email, parseInt(count), parseInt(startFrom), 'TCNRAW');
                });
            });
        });
    } else {
        rl.question('Masukkan email anda: ', (email) => {
            rl.question('Berapa banyak email yang ingin anda buat: ', (count) => {
                rl.question('Mulai dari angka berapa email akan di-generate: ', (startFrom) => {
                    startBatch(email, parseInt(count), parseInt(startFrom), refCode);
                });
            });
        });
    }
});
