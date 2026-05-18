const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

// MIME types
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

const server = http.createServer((req, res) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  
  // Health check
  if (req.url === '/health' || req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }
  
  // Página de mantenimiento con colores del sitio
  res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Car4You Panama - Mantenimiento</title>
  <link rel="icon" href="/favicon.ico" type="image/x-icon" sizes="16x16"/>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { 
      margin: 0; 
      padding: 0; 
      box-sizing: border-box; 
    }
    
    :root {
      --primary: #f97316;
      --primary-hover: #ea580c;
      --primary-foreground: #ffffff;
      --background: #fafafa;
      --foreground: #18181b;
      --muted: #f4f4f5;
      --muted-foreground: #71717a;
      --border: #e4e4e7;
      --radius: 0.625rem;
    }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--background);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: var(--foreground);
      line-height: 1.5;
    }
    
    .container {
      text-align: center;
      padding: 2rem;
      max-width: 480px;
      width: 100%;
    }
    
    .logo {
      width: 80px;
      height: 80px;
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%);
      border-radius: var(--radius);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 2rem;
      box-shadow: 0 10px 40px -10px rgba(249, 115, 22, 0.3);
    }
    
    .logo svg {
      width: 40px;
      height: 40px;
      color: var(--primary-foreground);
    }
    
    h1 { 
      font-size: 1.5rem; 
      font-weight: 700;
      margin-bottom: 0.75rem;
      color: var(--foreground);
      letter-spacing: -0.025em;
    }
    
    .subtitle {
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--primary);
      margin-bottom: 1rem;
    }
    
    p { 
      font-size: 1rem; 
      color: var(--muted-foreground);
      margin-bottom: 2rem;
      line-height: 1.6;
    }
    
    .spinner-container {
      margin-bottom: 2rem;
    }
    
    .spinner {
      width: 48px;
      height: 48px;
      border: 3px solid var(--border);
      border-top-color: var(--primary);
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto;
    }
    
    @keyframes spin { 
      to { transform: rotate(360deg); } 
    }
    
    .status { 
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: var(--muted); 
      color: var(--muted-foreground);
      padding: 0.75rem 1.5rem; 
      border-radius: var(--radius);
      font-size: 0.875rem;
      font-weight: 500;
      border: 1px solid var(--border);
    }
    
    .status-dot {
      width: 8px;
      height: 8px;
      background: var(--primary);
      border-radius: 50%;
      animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    
    .footer {
      position: fixed;
      bottom: 2rem;
      left: 50%;
      transform: translateX(-50%);
      text-align: center;
      color: var(--muted-foreground);
      font-size: 0.875rem;
    }
    
    .footer strong {
      color: var(--foreground);
      font-weight: 600;
    }
    
    @media (max-width: 480px) {
      .container {
        padding: 1.5rem;
      }
      
      h1 {
        font-size: 1.25rem;
      }
      
      .subtitle {
        font-size: 1rem;
      }
      
      .footer {
        position: relative;
        bottom: auto;
        margin-top: 3rem;
        transform: none;
        left: auto;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
      </svg>
    </div>
    
    <div class="subtitle">Car4You Panama</div>
    <h1>Estamos realizando mantenimiento</h1>
    <p>Estamos trabajando para mejorar tu experiencia. El sitio estará disponible nuevamente en breve.</p>
    
    <div class="spinner-container">
      <div class="spinner"></div>
    </div>
    
    <div class="status">
      <div class="status-dot"></div>
      <span>Sistema en mantenimiento</span>
    </div>
  </div>
  
  <div class="footer">
    <strong>Car4You Panama</strong> &copy; ${new Date().getFullYear()}
  </div>
</body>
</html>`);
});

server.listen(PORT, (err) => {
  if (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
  console.log(`🚗 Car4You Panama - Maintenance mode running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
