const { program } = require('commander');
const http = require('http');
const fs = require('fs').promises;
const { Builder } = require('xml2js');

// Налаштування командного рядка
program
  .requiredOption('-h, --host <host>', 'Server host')
  .requiredOption('-p, --port <port>', 'Server port')
  .requiredOption('-i, --input <file>', 'Path to input JSON file');

program.parse(process.argv);
const options = program.opts();

// Функція для читання JSON-файлу та його аналізу
async function processJSONFile(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    const jsonData = JSON.parse(data);

    // Перевіряємо, чи jsonData є масивом
    if (!Array.isArray(jsonData)) {
      throw new Error('Invalid JSON format');
    }

    // Фільтруємо потрібні категорії
    const totalIncome = jsonData
      .filter(entry => entry.parent === 'BS2_IncomeTotal')
      .reduce((sum, entry) => sum + entry.value, 0);

    const totalExpense = jsonData
      .filter(entry => entry.parent === 'BS2_ExpensesTotal')
      .reduce((sum, entry) => sum + entry.value, 0);

    // Формуємо XML
    const builder = new Builder();
    const xmlData = {
      data: {
        indicators: [
          { txt: 'Доходи, усього', value: totalIncome },
          { txt: 'Витрати, усього', value: totalExpense }
        ]
      }
    };

    return builder.buildObject(xmlData);

  } catch (error) {
    console.error('Error processing JSON file:', error.message);
    return null;
  }
}

// Створення HTTP-сервера
const server = http.createServer(async (req, res) => {
  const xmlResponse = await processJSONFile(options.input);
  
  if (xmlResponse) {
    res.writeHead(200, { 'Content-Type': 'application/xml' });
    res.end(xmlResponse);
  } else {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Error processing JSON file');
  }
});

// Запускаємо сервер
server.listen(options.port, options.host, () => {
  console.log(`Server running at http://${options.host}:${options.port}/`);
});
