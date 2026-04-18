# AI Complaint Triage System - Frontend

This is the production-ready frontend for the AI Complaint Triage System, built with Vite, React, TypeScript, and Tailwind CSS. It follows a "Refined Utility" aesthetic, offering a clean, high-contrast, and fast user interface.

## Personas & Features
1. **End Customer**: Public-facing intake form for direct complaint submission (`/`).
2. **Support Executive**: Admin dashboard for managing the complaint queue, tracking KPIs, resolving issues, and manually logging complaints (`/admin/*`).

## Key Views
- **Customer Intake**: Form at root. Submits direct to AI triage.
- **Admin Dashboard**: Live-updating KPIs (via SSE), charts for workload & SLA.
- **Complaint Queue**: Full pagination and complex filtering against the triage API.
- **Complaint Details**: Shows AI reasoning, confidence, and recommended actions. Strict state machine for status updates.

## Tech Stack
- **Framework**: React 19 + Vite
- **Styling**: Tailwind CSS v4
- **Routing**: React Router v6
- **Forms**: React Hook Form + Zod
- **Charts**: Recharts
- **Toast**: Sonner

## Setup & Running

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Environment Variables**:
   Create a `.env` file or rely on the default fallback to the backend port.
   ```env
   VITE_API_BASE_URL=http://localhost:4000/api
   ```

3. **Development Server**:
   ```bash
   npm run dev
   ```

4. **Production Build**:
   ```bash
   npm run build
   npm run preview
   ```
