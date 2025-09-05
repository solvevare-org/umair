# Umair Quiz App - Deployment Guide

## Overview
This application consists of:
- **Backend**: Express.js server on port 3004 (handles API, file uploads, database)
- **Frontend**: Static files served by backend + optional helper service on port 3002
- **Database**: MongoDB
- **Process Manager**: PM2
- **Web Server**: Nginx (reverse proxy)

## Prerequisites
- Node.js (v16 or higher)
- MongoDB
- PM2 (`npm install -g pm2`)
- Nginx
- Git

## Installation Steps

### 1. Clone and Setup
```bash
git clone <your-repo-url>
cd umair
```

### 2. Install Dependencies
**Option A: Install all at once (recommended)**
```bash
npm run install-all
```

**Option B: Install individually**
```bash
# Root dependencies
npm install

# Backend dependencies
cd backend
npm install
cd ..

# Frontend dependencies
cd frontend
npm install
cd ..
```

### 3. Environment Configuration
Create `.env` file in the root directory:
```bash
# Database
MONGODB_URI=mongodb://localhost:27017/quizDB

# OpenAI API
OPENAI_API_KEY=your_openai_api_key_here

# Optional: Custom ports
PORT=3004
FRONTEND_PORT=3002
```

### 4. Create Logs Directory
```bash
mkdir logs
```

### 5. Database Setup
Make sure MongoDB is running:
```bash
# Ubuntu/Debian
sudo systemctl start mongod

# macOS (if installed via Homebrew)
brew services start mongodb-community

# Windows
net start MongoDB
```

## PM2 Deployment

### Start Application
```bash
# Start both backend and frontend
npm start

# Or using PM2 directly
pm2 start ecosystem.config.js
```

### PM2 Management Commands
```bash
# View status
pm2 status

# View logs
npm run logs
# Or
pm2 logs

# Restart application
npm run restart
# Or
pm2 restart ecosystem.config.js

# Stop application
npm run stop
# Or
pm2 stop ecosystem.config.js

# Delete from PM2
npm run delete
# Or
pm2 delete ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

## Nginx Configuration

### 1. Copy Nginx Config
```bash
# Copy the provided nginx.conf to your nginx sites-available
sudo cp nginx.conf /etc/nginx/sites-available/umair-quiz-app

# Create symlink to sites-enabled
sudo ln -s /etc/nginx/sites-available/umair-quiz-app /etc/nginx/sites-enabled/

# Test nginx configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

### 2. Update Domain
Edit `/etc/nginx/sites-available/umair-quiz-app` and replace `your-domain.com` with your actual domain.

### 3. SSL Setup (Optional but Recommended)
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## Development Mode

### Start Development Servers
```bash
# Start both backend and frontend in development mode
npm run dev

# Or start individually:
# Backend (with nodemon)
cd backend && npm run dev

# Frontend
cd frontend && npm run dev
```

## Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Check what's using the port
   sudo netstat -tulpn | grep :3004
   
   # Kill the process
   sudo kill -9 <PID>
   ```

2. **PM2 Process Not Starting**
   ```bash
   # Check PM2 logs
   pm2 logs umair-backend
   pm2 logs umair-frontend
   
   # Check if ports are available
   netstat -tulpn | grep -E ':(3002|3004)'
   ```

3. **MongoDB Connection Issues**
   ```bash
   # Check MongoDB status
   sudo systemctl status mongod
   
   # Check MongoDB logs
   sudo journalctl -u mongod
   ```

4. **Nginx Configuration Issues**
   ```bash
   # Test nginx config
   sudo nginx -t
   
   # Check nginx error logs
   sudo tail -f /var/log/nginx/error.log
   ```

### Log Files
- PM2 logs: `pm2 logs`
- Application logs: `./logs/` directory
- Nginx logs: `/var/log/nginx/`

## File Structure After Setup
```
umair/
├── backend/                 # Backend Express server
│   ├── server.js           # Main server file
│   ├── package.json        # Backend dependencies
│   └── uploads/            # File uploads directory
├── frontend/               # Frontend static files
│   ├── openai.js          # Frontend helper service
│   ├── package.json       # Frontend dependencies
│   └── *.html             # HTML files
├── logs/                   # PM2 log files
├── package.json           # Root package.json with scripts
├── ecosystem.config.js    # PM2 configuration
├── nginx.conf            # Nginx configuration
└── .env                  # Environment variables
```

## Production Checklist
- [ ] Environment variables configured
- [ ] MongoDB running and accessible
- [ ] PM2 processes running (`pm2 status`)
- [ ] Nginx configuration tested and reloaded
- [ ] SSL certificate installed (if using HTTPS)
- [ ] Firewall configured (ports 80, 443)
- [ ] Log rotation configured
- [ ] Backup strategy in place
- [ ] Monitoring setup (optional)

## Monitoring (Optional)
```bash
# Install PM2 monitoring
pm2 install pm2-logrotate

# View real-time monitoring
pm2 monit
```

## Backup
```bash
# Backup MongoDB
mongodump --db quizDB --out /path/to/backup/

# Backup application files
tar -czf umair-backup-$(date +%Y%m%d).tar.gz /path/to/umair/
```

This deployment guide should help you get your application running smoothly with PM2 and Nginx!
