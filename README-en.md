<p align="center">
  <img src="doc/demo/logo.png" width="80" alt="Cloud Mail logo" />
</p>

<h1 align="center">Cloud Mail</h1>

<p align="center">
  A serverless email service built on Cloudflare for managing multiple accounts, sending and receiving emails, and storing attachments.
</p>

<p align="center">
  <a href="README.md">Chinese</a>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="MIT License" /></a>
  <img src="https://img.shields.io/badge/frontend-Vue%203-42b883.svg" alt="Vue 3" />
  <img src="https://img.shields.io/badge/backend-Cloudflare%20Workers-f38020.svg" alt="Cloudflare Workers" />
</p>

## Overview

Cloud Mail is a lightweight, responsive email management system. With a single domain, you can create and manage multiple email accounts while deploying the backend on Cloudflare's edge infrastructure to reduce traditional server and maintenance costs.

This project is also a practical example of a full-stack serverless application, covering frontend and backend separation, access control, email processing, object storage, and data visualization.

## Features

- **Email account management**: Create and manage multiple email accounts and domains.
- **Email delivery**: Receive, send, reply to, forward, and track emails.
- **Attachment handling**: Upload, receive, and download attachments stored in Cloudflare R2.
- **Admin console**: Manage users, emails, system settings, and permissions.
- **Role-based access control**: Restrict features and resource access by user role.
- **Email forwarding**: Forward received emails to Telegram or other email services.
- **Verification code recognition**: Use Workers AI to detect verification codes in emails.
- **Data visualization**: Use ECharts to display system, user, and email metrics.
- **Security protection**: Integrate Cloudflare Turnstile to reduce automated registration and abuse.
- **Responsive interface**: Support desktop and major mobile browsers.
- **Internationalization**: Built-in Chinese and English interfaces.
- **Open API**: Support batch user creation and conditional email queries.

## Tech Stack

### Frontend

- Vue 3 + Vite
- Element Plus
- Pinia
- Vue Router
- Vue I18n
- ECharts

### Backend and Infrastructure

- Cloudflare Workers
- Hono
- Drizzle ORM
- Cloudflare D1: Relational data storage
- Cloudflare KV: Caching and configuration storage
- Cloudflare R2: Attachment and object storage
- Resend: Email delivery service
- Workers AI: Verification code recognition
- Cloudflare Turnstile: CAPTCHA protection

## Project Structure

```text
cloud-mail/
├── mail-vue/                 # Vue 3 frontend application
│   └── src/
│       ├── components/       # Shared components
│       ├── layout/            # Page layouts
│       ├── request/           # API request layer
│       ├── router/            # Router configuration
│       ├── store/             # Global state
│       └── views/             # Page components
├── mail-worker/              # Cloudflare Workers backend
│   ├── src/
│   │   ├── api/              # API endpoints
│   │   ├── dao/              # Data access layer
│   │   ├── email/             # Email processing
│   │   ├── security/          # Authentication and authorization
│   │   ├── service/           # Business services
│   │   └── index.js           # Worker entry point
│   └── wrangler.toml          # Workers configuration
├── doc/                      # Deployment and usage documentation
└── LICENSE
```

## Local Development

### Requirements

- Node.js 18 or later
- pnpm
- A Cloudflare account and Wrangler CLI

### Start the frontend

```bash
cd mail-vue
pnpm install
pnpm dev
```

### Start the backend

```bash
cd mail-worker
pnpm install
pnpm dev
```

For Cloudflare D1, KV, R2, domain, and email service configuration, refer to the deployment documentation under [`doc`](doc). Fill in the configuration files and secrets for your environment. Never commit API tokens, database credentials, or other sensitive information to the repository.

## Build and Deployment

Build the frontend:

```bash
cd mail-vue
pnpm build
```

Deploy the Worker:

```bash
cd mail-worker
pnpm deploy
```

After the first deployment, visit the existing initialization URL to initialize the database and create the administrator account. The administrator email is read from the `admin` environment variable and can no longer be created through public sign-up:

```bash
https://your-project-domain/api/init/your-jwt-secret
```

The response shows a generated administrator temporary password once; save it immediately, sign in, and change it in Personal Settings. After upgrading from an older version, visit the URL once to write the trusted administrator marker and reset the account password. Do not publicly share or retain the initialization URL because it contains `jwt_secret`.

For an automated deployment, do not configure an automatic initialization URL for the first deployment; open the URL manually to view the temporary password.

Before deployment, make sure the D1, KV, and R2 bindings and environment variables in the Wrangler configuration are set up. For production, deployment through GitHub Actions or another CI workflow is recommended.

## Screenshots

| Mailbox List | Email Details |
| :---: | :---: |
| ![Mailbox list](doc/demo/demo1.png) | ![Email details](doc/demo/demo2.png) |

| Admin Console | System Analytics |
| :---: | :---: |
| ![Admin console](doc/demo/demo3.png) | ![System analytics](doc/demo/demo4.png) |

## License

This project is licensed under the [MIT License](LICENSE).
