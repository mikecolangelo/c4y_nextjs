module.exports = {
  apps: [
    {
      name: 'next',
      script: 'npx',
      args: 'next dev -H 0.0.0.0 -p 3000',
      cwd: '/home/deploy/frontend',
      env: {
        NODE_ENV: 'development',
        NODE_OPTIONS: '--max-old-space-size=2560'
      },
      max_memory_restart: '3G',
      restart_delay: 3000,
      max_restarts: 5,
      min_uptime: '10s'
    },
    {
      name: 'strapi',
      script: 'npm',
      args: 'start',
      cwd: '/home/deploy/backend',
      env: {
        NODE_ENV: 'production',
        DATABASE_CLIENT: 'postgres'
      },
      max_memory_restart: '1G'
    }
  ]
};
