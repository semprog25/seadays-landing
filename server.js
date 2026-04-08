'use strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3001;

const SUPABASE_URL = 'https://soqkgrfzluewpuiguypm.supabase.co/functions/v1/make-server-51d3ca8d';
const BLOG_PATH = '/portside-articles?limit=100&forWebsite=1';
const CACHE_TTL_MS = 60 * 1000; // 60 seconds
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : ['https://seadays.app', 'http://localhost:' + PORT, 'http://127.0.0.1:' + PORT, 'http://localhost:3000', 'http://127.0.0.1:3000'];

let blogCache = null;
let blogCacheTime = 0;

function isCacheValid() {
  return blogCache !== null && (Date.now() - blogCacheTime) < CACHE_TTL_MS;
}

function fetchBlogFromSupabase() {
  const key = process.env.SUPABASE_ANON_KEY;
  if (!key) {
    return Promise.reject(new Error('SUPABASE_ANON_KEY not set'));
  }
  const url = SUPABASE_URL + BLOG_PATH;
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'Authorization': 'Bearer ' + key,
        'apikey': key,
      },
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error('Upstream error'));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.some(o => o === origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  optionsSuccessStatus: 200
};

app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many requests' },
  standardHeaders: true,
  keyGenerator: (req) => req.ip || 'unknown'
}));

app.get('/api/blog', cors(corsOptions), function (req, res) {
  if (isCacheValid()) {
    return res.json(blogCache);
  }
  fetchBlogFromSupabase()
    .then(function (data) {
      blogCache = data;
      blogCacheTime = Date.now();
      res.json(data);
    })
    .catch(function () {
      res.status(500).json({ error: 'Unable to load content', articles: [] });
    });
});

function fetchSingleArticle(articleId) {
  const key = process.env.SUPABASE_ANON_KEY;
  if (!key) {
    return Promise.reject(new Error('SUPABASE_ANON_KEY not set'));
  }
  const url = SUPABASE_URL + '/portside-articles/' + encodeURIComponent(articleId);
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'Authorization': 'Bearer ' + key,
        'apikey': key,
      },
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode === 404) {
          resolve(null);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error('Upstream error'));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

app.get('/api/blog/:articleId', cors(corsOptions), function (req, res) {
  const articleId = req.params.articleId;
  if (!articleId || !articleId.trim()) {
    return res.status(400).json({ error: 'Missing article ID' });
  }
  fetchSingleArticle(articleId.trim())
    .then(function (data) {
      if (!data || !data.article) {
        return res.status(404).json({ error: 'Article not found' });
      }
      res.json(data);
    })
    .catch(function () {
      res.status(500).json({ error: 'Unable to load article' });
    });
});

/** Dynamic sitemap.xml: includes all blog articles for SEO. Served when server runs. */
app.get('/sitemap.xml', function (req, res) {
  res.type('application/xml');
  const base = 'https://seadays.app';
  const staticUrls = [
    { loc: base + '/', changefreq: 'weekly', priority: '1.0' },
    { loc: base + '/blog/', changefreq: 'daily', priority: '0.9' },
  ];
  fetchBlogFromSupabase()
    .then(function (data) {
      const articles = (data && data.articles) ? data.articles : [];
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
      staticUrls.forEach(function (u) {
        xml += '  <url><loc>' + escapeXml(u.loc) + '</loc><changefreq>' + u.changefreq + '</changefreq><priority>' + u.priority + '</priority></url>\n';
      });
      articles.forEach(function (a) {
        if (a && a.id) {
          const url = base + '/blog-article.html?id=' + encodeURIComponent(a.id);
          xml += '  <url><loc>' + escapeXml(url) + '</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>\n';
        }
      });
      xml += '</urlset>';
      res.send(xml);
    })
    .catch(function () {
      const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        staticUrls.map(function (u) {
          return '  <url><loc>' + escapeXml(u.loc) + '</loc><changefreq>' + u.changefreq + '</changefreq><priority>' + u.priority + '</priority></url>';
        }).join('\n') + '\n</urlset>';
      res.send(xml);
    });
});

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

app.use(express.static(path.join(__dirname)));

app.listen(PORT, function () {
  console.log('SeaDays landing server on port', PORT);
});
