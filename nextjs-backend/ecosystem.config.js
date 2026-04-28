module.exports = {
  apps: [{
    name: 'nextjs-backend',
    script: 'node_modules/next/dist/bin/next',
    args: 'start',
    cwd: '/www/wwwroot/silver-hair-api/nextjs-backend',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: '/www/wwwroot/silver-hair-api/logs/error.log',
    out_file: '/www/wwwroot/silver-hair-api/logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss'
  }]
}
