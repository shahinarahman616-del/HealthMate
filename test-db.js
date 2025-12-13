const mysql = require('mysql2');

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'healthmate_app'
});

db.connect((err) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
    return;
  }
  console.log('✅ Connected to MySQL Database via XAMPP');
  
  // Test query
  db.query('SHOW TABLES', (err, results) => {
    if (err) {
      console.error('❌ Query failed:', err.message);
      return;
    }
    console.log('✅ Database tables:', results);
  });
  
  db.end();
});