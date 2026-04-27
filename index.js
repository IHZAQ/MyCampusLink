import express from 'express';
import mongoose from 'mongoose';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import qrcode from 'qrcode';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ quiet: true });
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Connect to MongoDB
mongoose.connect(process.env.MONGODB).then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

// User Schema
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  darkMode: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const User = mongoose.model('User', userSchema);

// URL Schema
const urlSchema = new mongoose.Schema({
  originalUrl: {
    type: String,
    required: true,
  },
  shortCode: {
    type: String,
    required: true,
    unique: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Url = mongoose.model('Url', urlSchema);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Generate short code
function generateShortCode() {
  return crypto.randomBytes(3).toString('hex');
}

// Auth Routes
app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashedPassword });
    await user.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ error: 'Username or email already exists' });
    } else {
      res.status(500).json({ error: 'Server error' });
    }
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id, username: user.username, email: user.email }, JWT_SECRET);
    res.json({ 
      token, 
      user: { 
        id: user._id, 
        username: user.username, 
        email: user.email,
        darkMode: user.darkMode 
      } 
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Routes
app.post('/shorten', authenticateToken, async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const shortCode = generateShortCode();
    const newUrl = new Url({
      originalUrl: url,
      shortCode,
      user: req.user.id,
    });
    await newUrl.save();

    const shortUrl = `${process.env.NEXT_PUBLIC_VERCEL_URL || `http://localhost:${PORT}`}/${shortCode}`;
    const qrCode = await qrcode.toDataURL(shortUrl);

    res.json({
      originalUrl: url,
      shortUrl,
      qrCode,
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/links', authenticateToken, async (req, res) => {
  try {
    const urls = await Url.find({ user: req.user.id }).sort({ createdAt: -1 });
    const links = await Promise.all(urls.map(async (url) => {
      const shortUrl = `${process.env.SERVER_URL || `http://localhost:${PORT}`}/${url.shortCode}`;
      const qrCode = await qrcode.toDataURL(shortUrl);
      return {
        originalUrl: url.originalUrl,
        shortUrl,
        qrCode,
        shortCode: url.shortCode,
        createdAt: url.createdAt,
      };
    }));
    res.json(links);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/links/:shortCode', authenticateToken, async (req, res) => {
  const { shortCode } = req.params;
  const { originalUrl } = req.body;

  if (!originalUrl) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const url = await Url.findOne({ shortCode, user: req.user.id });
    if (!url) {
      return res.status(404).json({ error: 'Link not found' });
    }

    url.originalUrl = originalUrl;
    await url.save();
    res.json({ message: 'URL updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/links/:shortCode', authenticateToken, async (req, res) => {
  const { shortCode } = req.params;

  try {
    const result = await Url.deleteOne({ shortCode, user: req.user.id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Link not found' });
    }
    res.json({ message: 'Link deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/user-settings', authenticateToken, async (req, res) => {
  const { darkMode } = req.body;

  try {
    const user = await User.findByIdAndUpdate(req.user.id, { darkMode }, { returnDocument: 'after' });
    res.json({ message: 'Settings updated', darkMode: user.darkMode });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/:shortCode', async (req, res) => {
  const { shortCode } = req.params;
  try {
    const url = await Url.findOne({ shortCode });
    if (url) {
      res.redirect(url.originalUrl);
    } else {
      res.status(404).json({ error: 'URL not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;