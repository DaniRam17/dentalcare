# Documentación DentalCare Pro

## 1. Arquitectura General
El sistema sigue una arquitectura de **N-Capas** desacoplada:
- **Capa de Presentación (Frontend):** React + Vite. Comunicación vía REST API.
- **Capa de Aplicación (Backend):** Node.js + Express + TypeScript. Maneja lógica de negocio, validaciones y seguridad.
- **Capa de Datos (Persistencia):** Prisma ORM sobre PostgreSQL.
- **Capa de Seguridad:** JWT para autenticación y RBAC para autorización.

### Diagrama de Flujo
`Usuario -> Frontend (React) -> API (Express) -> Controladores -> Prisma ORM -> PostgreSQL`

## 2. Variables de Entorno y Seguridad
El proyecto utiliza un archivo `.env` local con datos sensibles. Este archivo NO debe subirse al repositorio.

Archivo de ejemplo: `.env.example`

Variables principales:

- `DATABASE_URL` — Cadena de conexión PostgreSQL
- `JWT_SECRET` — Clave secreta para JWT
- `PORT` — Puerto de ejecución del servidor
- `NODE_ENV` — `development` o `production`
- `VITE_HMR_PORT` — Solo si se necesita HMR en un puerto específico

### Qué ignora `.gitignore`

- `node_modules/`
- `dist/`, `build/`, `coverage/`
- `.env` y archivos de entorno locales
- `uploads/` (archivos subidos en tiempo de ejecución)
- registros (`*.log`)
- bases de datos locales (`prisma/*.db`, `*.sqlite`)
- archivos de sistema (`.DS_Store`, `Thumbs.db`)

## 3. Configuración y ejecución

### Instalar dependencias
```bash
pnpm install
```

### Configurar `.env`
```bash
cp .env.example .env
```

### Ejecutar con Docker
```bash
docker compose up -d
```

### Generar Prisma Client
```bash
pnpm prisma:generate
```

### Aplicar migraciones
```bash
pnpm prisma:migrate --name init
```

### Sembrar datos iniciales
```bash
pnpm seed
```

### Ejecutar la aplicación
```bash
pnpm dev
```

### URL de acceso
```text
http://localhost:3000
```

## 4. Base de datos y modelos principales

La base de datos está diseñada para manejar empleados, pacientes, citas y procedimientos con compatibilidad para módulos avanzados.

### Roles y estados
- `Employee.role`: ADMIN, DOCTOR, RECEPTIONIST, NURSE
- `Appointment.status`: SCHEDULED, CONFIRMED, ATTENDED, CANCELLED

### Tablas principales
- `Employee`
- `Patient`
- `Appointment`

### Índices recomendados
- `idx_appointment_date` en `Appointment.date`
- `idx_patient_doc` en `Patient.documentNumber`

## 5. Matriz de permisos (RBAC)
| Acción | Admin | Doctor | Recepcionista | Enfermero |
|---|---|---|---|---|
| Gestionar empleados | ✅ | ❌ | ❌ | ❌ |
| Crear/editar pacientes | ✅ | ❌ | ✅ | ❌ |
| Ver historias clínicas | ✅ | ✅ | ❌ | ✅ |
| Agendar citas | ✅ | ✅ | ✅ | ❌ |
| Emitir recetas | ✅ | ✅ | ❌ | ❌ |
| Ver reportes financieros | ✅ | ❌ | ❌ | ❌ |

## 6. Reglas de negocio clave
- No eliminar pacientes con citas históricas.
- `ATTENDED` solo se aplica en fechas iguales o anteriores al día actual.
- Solo `ADMIN` puede reabrir citas canceladas.
- Las recetas no se editan después de 24 horas.

## 7. Endpoints principales
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

## 8. Notas adicionales
- El servidor de desarrollo se ejecuta desde `server.ts`.
- En desarrollo usa middleware de Vite.
- En producción sirve `dist/` como contenido estático.
- No registres datos sensibles ni archivos de usuario en el control de versiones.
