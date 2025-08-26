import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

// Use JSON parser for API requests if needed
app.use(express.json());

// Example route
app.get('/', (req, res) => {
  res.send('Hello, Mood Music Player!');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
