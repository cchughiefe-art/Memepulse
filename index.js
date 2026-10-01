// Entry-file fallback for hosting panels. Environment values override .env.
import { existsSync } from 'node:fs';
if (existsSync('.env')) process.loadEnvFile('.env');
await import('./src/ab-server.js');
