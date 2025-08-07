// binance.js - Real-time order book logger with file logging and deduplicated inserts

const WebSocket = require('ws');
const axios = require('axios');
const { ClickHouse } = require('clickhouse');
const moment = require('moment-timezone'); // updated to moment-timezone
const fs = require('fs');
const path = require('path');
const config = require('./config.json');

// Logging setup
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
const logFile = path.join(logDir, 'binance.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });
function log(message) {
    const timestamp = moment().format("YYYY-MM-DD HH:mm:ss");
    const line = `[${timestamp}] ${message}\n`;
    logStream.write(line);
    console.log(line.trim());
}

const cfgNumLevels = config.binance.numLevel;
const cfgWS_URL = config.binance.WebSocketUrl;
const cfgREST_URL = config.binance.REST_Url;
const cfgTradePair = config.binance.BTCUSDT_tradePair;
const cfgTableName = config.table.BTCUSDT_table;
const cfgVolumeFlag = config.binance.baseVolume;
const { host, port, user, password } = config.chDatabase;

const chClient = new ClickHouse({
  url: `http://${host}`,
  port,
  basicAuth: { username: user, password },
  isUseGzip: false,
  format: 'json'
});

let orderBook = [];
let lastTopBid = null;
let lastTopAsk = null;

async function executeQuery(query) {
  try {
    const rows = await chClient.query(query).toPromise();
    return rows;
  } catch (err) {
    log(`❌ Query error: ${err.message}`);
  }
}

async function insertOrderBookToDB(orderBook, timestamp) {
  const bids = orderBook.filter(o => o.side === 'Buy').sort((a, b) => b.price - a.price).slice(0, cfgNumLevels);
  const asks = orderBook.filter(o => o.side === 'Sell').sort((a, b) => a.price - b.price).slice(0, cfgNumLevels);

  if (!bids.length || !asks.length) return;

  const topBid = bids[0].price;
  const topAsk = asks[0].price;

  // Skip insert if spread hasn't changed
  if (topBid === lastTopBid && topAsk === lastTopAsk) return;
  lastTopBid = topBid;
  lastTopAsk = topAsk;

  for (let i = 0; i < bids.length; i++) {
    const bid = bids[i];
    const volumeBid = cfgVolumeFlag ? bid.quantity : bid.price * bid.quantity;
    const query = `INSERT INTO ${cfgTableName} (timestamp, platform, order_level, order_type, price, volume)
      VALUES ('${timestamp}', 'Binance', '${i + 1}', 'Bid', '${bid.price}', '${volumeBid}')`;
    await executeQuery(query);
    log(`Inserted Bid: Level ${i + 1}, Price ${bid.price}, Volume ${volumeBid}`);
  }

  for (let i = 0; i < asks.length; i++) {
    const ask = asks[i];
    const volumeAsk = cfgVolumeFlag ? ask.quantity : ask.price * ask.quantity;
    const query = `INSERT INTO ${cfgTableName} (timestamp, platform, order_level, order_type, price, volume)
      VALUES ('${timestamp}', 'Binance', '${i + 1}', 'Ask', '${ask.price}', '${volumeAsk}')`;
    await executeQuery(query);
    log(`Inserted Ask: Level ${i + 1}, Price ${ask.price}, Volume ${volumeAsk}`);
  }

  log(`✅ Inserted ${bids.length + asks.length} rows @ ${timestamp} | Spread: ${topAsk - topBid}`);
}

function handleOrderBook(event) {
  const message = JSON.parse(event.data);
  // Use moment-timezone to format timestamp in Europe/London timezone without trailing 'Z'
  const currentTimestamp = moment().tz('Europe/London').format("YYYY-MM-DD HH:mm:ss.SSS");

  for (const bid of message.bids) {
    const price = parseFloat(bid[0]);
    const quantity = parseFloat(bid[1]);
    const index = orderBook.findIndex(o => o.price === price && o.side === 'Buy');
    if (quantity === 0) index > -1 && orderBook.splice(index, 1);
    else index > -1 ? orderBook[index].quantity = quantity : orderBook.push({ price, quantity, side: 'Buy' });
  }

  for (const ask of message.asks) {
    const price = parseFloat(ask[0]);
    const quantity = parseFloat(ask[1]);
    const index = orderBook.findIndex(o => o.price === price && o.side === 'Sell');
    if (quantity === 0) index > -1 && orderBook.splice(index, 1);
    else index > -1 ? orderBook[index].quantity = quantity : orderBook.push({ price, quantity, side: 'Sell' });
  }

  if (!handleOrderBook.insertTimeout) {
    handleOrderBook.insertTimeout = setTimeout(() => {
      insertOrderBookToDB(orderBook, currentTimestamp);
      handleOrderBook.insertTimeout = null;
    }, 1000); // 1 insert per second max
  }
}

async function init() {
  try {
    await chClient.query(`
      CREATE TABLE IF NOT EXISTS ${cfgTableName} (
        timestamp DateTime64(3, 'Europe/London'),
        platform String CODEC(ZSTD(1)),
        order_level Float64 CODEC(ZSTD(1)),
        order_type String CODEC(ZSTD(1)),
        price Float64 CODEC(ZSTD(1)),
        volume Float64 CODEC(ZSTD(1))
      ) ENGINE = MergeTree() ORDER BY timestamp
    `).toPromise();

    const response = await axios.get(cfgREST_URL);
    const { bids, asks } = response.data;
    orderBook = [
      ...bids.map(b => ({ price: parseFloat(b[0]), quantity: parseFloat(b[1]), side: 'Buy' })),
      ...asks.map(a => ({ price: parseFloat(a[0]), quantity: parseFloat(a[1]), side: 'Sell' }))
    ];

    log("Binance: Initial Order Book Received");

    const ws = new WebSocket(cfgWS_URL + cfgTradePair);
    ws.addEventListener('open', () => log("Connected to Binance WebSocket API Successfully"));
    ws.addEventListener('message', handleOrderBook);

  } catch (err) {
    log('Initialization failed: ' + err);
  }
}

init();