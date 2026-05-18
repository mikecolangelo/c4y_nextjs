module.exports = {
  apps: [
    {
      name: 'next',
      script: 'npx',
      args: 'next start -H 0.0.0.0 -p 3000',
      cwd: '/home/deploy/frontend',
      env: {
        NODE_ENV: 'production',
        NODE_OPTIONS: '--max-old-space-size=2560'
      },
      max_memory_restart: '3G',
      restart_delay: 3000,
      max_restarts: 5,
      min_uptime: '10s'
    }
  ]
};
