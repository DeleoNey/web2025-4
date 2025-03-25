const { program } = require('commander');
const http = require('http');
const https = require('https');
const xml2js = require('xml2js');
const fs = require('fs');


// Налаштування командного рядка
program
  .requiredOption('-h, --host <host>', 'Адреса сервера')
  .requiredOption('-p, --port <port>', 'Порт сервера')
  .requiredOption('-i, --url <url>', 'Файл, з xml даними');

program.parse(process.argv);
const options = program.opts();

// Функція отримання XML
async function fetchXMLData(url) {
  return new Promise((resolve, reject) => {
    fs.readFile(url, 'utf-8', (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}



// Функція обробки XML
async function processXMLData(xmlData) {
  try {
    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(xmlData);

    // Перевірка наявності елементів "banksincexp"
    if (!result.indicators || !result.indicators.banksincexp) {
      throw new Error('Невірний формат XML: відсутній елемент "banksincexp".');
    }

    // Перевірка, чи banksincexp є масивом
    const entries = Array.isArray(result.indicators.banksincexp) 
      ? result.indicators.banksincexp 
      : [result.indicators.banksincexp];

    // Обчислення загального доходу
    const totalIncome = entries
      .filter(entry => entry.parent === 'BS2_IncomeTotal' && entry.value)
      .reduce((sum, entry) => sum + parseFloat(entry.value) || 0, 0);

    // Обчислення загальних витрат
    const totalExpense = entries
      .filter(entry => entry.parent === 'BS2_ExpensesTotal' && entry.value)
      .reduce((sum, entry) => sum + parseFloat(entry.value) || 0, 0);

    // Формування відповіді XML
    const builder = new xml2js.Builder();
    const xmlResponse = builder.buildObject({
      data: {
        indicators: [
          { txt: 'Доходи, усього', value: totalIncome.toFixed(2) },
          { txt: 'Витрати, усього', value: totalExpense.toFixed(2) }
        ]
      }
    });

    return xmlResponse;

  } catch (error) {
    console.error('Помилка обробки XML-даних:', error.message);
    return null;
  }
}

	

// Створення HTTP-сервера
const server = http.createServer(async (req, res) => {
  try {
    const xmlData = await fetchXMLData(options.url);
    const xmlResponse = await processXMLData(xmlData);

    if (xmlResponse) {
      res.writeHead(200, { 'Content-Type': 'application/xml' });
      res.end(xmlResponse);
    } else {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Помилка обробки XML-даних');
    }
  } catch (error) {
    console.error('Помилка отримання XML-даних:', error.message);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Помилка отримання XML-даних');
  }
});

// Запуск сервера
server.listen(options.port, options.host, () => {
  console.log(`Сервер працює за адресою http://${options.host}:${options.port}/`);
});
