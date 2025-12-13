// Use the promise version for better error handling
const mysql = require('mysql2/promise');
const url = require('url');

(async () => {
  try {
    const dbUrl = process.env.DATABASE_URL;

    if (!dbUrl) {
      throw new Error('❌ DATABASE_URL environment variable is missing');
    }

    // Parse the Railway URL
    const params = url.parse(dbUrl);
    const [user, password] = params.auth.split(':');

    const connection = await mysql.createConnection({
      host: params.hostname,
      user,
      password,
      database: params.pathname.replace('/', ''),
      port: Number(params.port)
    });

    console.log('✅ Connected to MySQL Database via Railway URL');

    // Optional: list tables
    const [rows] = await connection.query('SHOW TABLES');
    console.log('✅ Database tables:', rows);

    await connection.end();
  } catch (err) {
    console.error('❌ MySQL connection error:', err.message);
  }
})();
