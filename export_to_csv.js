// export_to_csv.js - Reliable version using official ClickHouse client

const fs = require('fs');
const path = require('path');
const { ClickHouse } = require('clickhouse');
const { parse } = require('json2csv');
const config = require('./config.json');

// Output config
const outputDir = path.join(__dirname, 'exports');
const outputFile = path.join(outputDir, 'orderbook_dump.csv');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

// Connect to ClickHouse using new client
const { host, port, user, password } = config.chDatabase;
const clickhouse = new ClickHouse({
  url: `http://${host}`,
  port,
  basicAuth: { username: user, password },
  isUseGzip: false,
  format: 'json',
  config: {
    session_timeout: 60,
  },
});

async function exportToCSV() {
  try {
    const query = `
      SELECT timestamp, platform, order_level, order_type, price, volume
      FROM ${config.table.BTCUSDT_table}
      ORDER BY timestamp DESC
      LIMIT 1000
    `;

    const rows = await clickhouse.query(query).toPromise();

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      console.error('❌ No rows returned from ClickHouse');
      return;
    }

    const csv = parse(rows);
    fs.writeFileSync(outputFile, csv);
    console.log(`✅ Exported ${rows.length} rows to ${outputFile}`);
  } catch (err) {
    console.error('❌ Failed to export to CSV:', err.message);
  }
}

exportToCSV();
