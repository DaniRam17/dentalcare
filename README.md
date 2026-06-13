# DentalCare Pro - Sistema de Gestión Odontológica

Proyecto actualizado para trabajar con **pnpm**, React + Vite, Node.js + Express + TypeScript, Prisma ORM y PostgreSQL.

Esta versión se adaptó al nuevo diagrama de clases del sistema odontológico con módulos adicionales para historial clínico, responsables, archivos clínicos, consentimientos, facturación, pagos, inventario, especialidades, notificaciones y auditoría.

## Requisitos

- Node.js 20 o superior
- pnpm instalado
- Docker Desktop opcional
- Visual Studio Code

## Configuración de variables de entorno

Copia el archivo de ejemplo y ajusta los valores reales en `.env`.

```bash
cp .env.example .env
```

Variables obligatorias:

- `DATABASE_URL` — Cadena de conexión de PostgreSQL
- `JWT_SECRET` — Clave secreta para tokens JWT
- `PORT` — Puerto donde se ejecuta el servidor
- `NODE_ENV` — `development` o `production`
- `VITE_HMR_PORT` — Solo si necesitas HMR en un puerto específico

> Importante: `.env` no debe subirse al repositorio. El archivo `.env.example` es el único archivo de entorno de ejemplo que se mantiene en el código.

## Qué ignora `.gitignore`

- `node_modules/`
- `dist/`, `build/`, `coverage/`
- `.env` y archivos de entorno locales
- `uploads/` (archivos subidos en tiempo de ejecución)
- registros (`*.log`)
- archivos de base de datos locales (`prisma/*.db`, `*.sqlite`)
- archivos de sistema (`.DS_Store`, `Thumbs.db`)

## Instalación

```bash
pnpm install
```

## Base de datos

Si usas Docker:

```bash
docker compose up -d
```

Generar Prisma Client:

```bash
pnpm prisma:generate
```

Aplicar migraciones:

```bash
pnpm prisma:migrate --name init
```

Ejecutar seed:

```bash
pnpm seed
```

## Ejecutar la aplicación

```bash
pnpm dev
```

Abre el navegador en:

```text
http://localhost:3000
```

## Usuarios de prueba

```text
Administrador:
admin@dentalcare.com
admin123

Odontólogo:
doctor@dentalcare.com
admin123
```

## Tecnologías principales

- Frontend: React + Vite
- Backend: Node.js + Express + TypeScript
- ORM: Prisma
- Base de datos: PostgreSQL
- Autenticación: JWT

## Módulos principales

- Pacientes
- Citas y agenda
- Recetas
- Procedimientos
- Empleados
- Turnos
- Historial clínico
- Responsables
- Archivos clínicos
- Consentimientos
- Facturación y pagos
- Inventario
- Especialidades
- Notificaciones
- Auditoría

## Endpoints principales

- `/api/auth`
- `/api/patients`
- `/api/appointments`
- `/api/employees`
- `/api/procedures`
- `/api/prescriptions`
- `/api/shifts`
- `/api/reports`
- `/api/design`
- `/api` (integrated)

## Notas

- El backend usa `server.ts` con middleware de Vite en desarrollo.
- En producción, sirve los archivos estáticos desde `dist/`.
- Asegúrate de no incluir archivos de datos sensibles como `.env` ni archivos de uploads en el control de versiones.
