// test-db.js - FIXED VERSION
const mysql = require('mysql2');

const db = mysql.createConnection({
  host: process.env.DB_HOST,           // shortline.proxy.rlwy.net
  user: process.env.DB_USER,           // root
  password: process.env.DB_PASSWORD,   // PMEyVWaNBsFbEWMjzhirCUfrTVouXhNm
  database: process.env.DB_NAME,       // railway
  port: Number(process.env.DB_PORT)    // 59848
  // REMOVE THE 'ssl: false' LINE ENTIRELY
});

db.connect((err) => {
  if (err) {
    console.error('❌ MySQL connection error:', err);
    return;
  }
  console.log('✅ Connected to MySQL database');
});