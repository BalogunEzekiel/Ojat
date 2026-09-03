# Ojat AI
Production-oriented WhatsApp-to-SaaS AI conversational commerce platform.

## Architecture
- client: React + Vite
- server: Node.js + Express + Prisma + PostgreSQL
- Redis + BullMQ for async jobs
- Cloudinary for media
- WhatsApp Cloud API webhooks
- Paystack payment abstraction
- Groq AI-compatible structured AI extraction

## Quick start
1. Copy `server/.env.example` to `server/.env`.
2. Create PostgreSQL and Redis databases.
3. `cd server && npm install`
4. `npx prisma migrate dev`
5. `npm run prisma:seed`
6. `npm run dev`
7. `cd ../client && npm install && npm run dev`

## Production
Frontend: Render Static Site, build `npm install && npm run build`, publish `dist`.
Backend: Render Web Service, build `npm install && npx prisma generate`, start `npm start`.
Set all environment variables in Render. Run `npx prisma migrate deploy` as a pre-deploy command or deployment step.

## WhatsApp
Configure Meta Cloud API webhook:
`GET /api/v1/webhooks/whatsapp` for verification
`POST /api/v1/webhooks/whatsapp` for events

## Paystack
Set callback/webhook URL:
`POST /api/v1/webhooks/paystack`

## Security notes
Use strong secrets, HTTPS, production Redis, verified webhooks, and least-privilege API keys.
