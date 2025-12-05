# EA Falco Dashboard – ID Card Processor

## Overview

ID Card Processor is a full-stack web app for managing and updating ID card data, processing card photos, and integrating with a Vault API for card registration and updates.

## Architecture

- Frontend: React + Vite + TailwindCSS + Shadcn UI
- Backend: Node.js + Express
- Processing: Python integration via backend
- Storage: Session-based upload/output folders; SQL Server for app data and audit trail

## Quick Start (Docker Compose)

Prerequisites: Docker Desktop installed and running.

```sh
# From project root
docker compose build
docker compose up -d

# Frontend URL
open http://localhost:9011

# Backend health
curl http://localhost:3005/api/health
```

- Frontend container: `data-processor-frontend` (exposes `http://localhost:9011`)
- Backend container: `data-processor-backend` (exposes `http://localhost:3005` → internal `3001`)

## Configuration (server/.env)

Create `server/.env` with your environment values:

```env
# Application DB (preferred) or Data DB (fallback)
APPDB_SERVER=your-sql-host
APPDB_NAME=your-db-name
APPDB_USER=your-db-user
APPDB_PASSWORD=your-db-password
APPDB_PORT=1433

# Fallback if APPDB_* not set
DATADB_SERVER=your-sql-host
DATADB_NAME=your-db-name
DATADB_USER=your-db-user
DATADB_PASSWORD=your-db-password
DATADB_PORT=1433

# Auth/session
APP_SECRET=change-this-secret

# Vault API endpoint
VAULT_API_BASE=http://10.60.10.6/Vaultsite/APIwebservice.asmx

# Optional audit retention
AUDIT_RETENTION_DAYS=90
AUDIT_ARCHIVE=false
```

## Local Development (without Docker)

```sh
# Frontend
npm install
npm run dev

# Backend (in server/)
cd server
npm install
npm run start

# Open UI
open http://localhost:5173
```

## Features

- File upload of images and Excel/CSV
- Preview and batch register/update cards to Vault
- CardDB filtering by department, status, access, vehicle number
- Activity log with audit trail

## Tech Stack

- Vite, TypeScript, React
- TailwindCSS, Shadcn UI
- Node.js, Express, MSSQL
