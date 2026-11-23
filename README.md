# Puntuando lugares

Aplicación web en TypeScript para llevar una guía compartida de lugares para comer (desayuno, almuerzo, merienda y cena), puntuar del 1 al 10 en pasos de 0,1, guardar reseñas, dirección con acceso a Google Maps, fotos de las comidas, sortear pendientes y organizar grupos entre amigos.

## Stack

- **Next.js (App Router) + React + TypeScript**
- **Tailwind CSS v4** (modo claro por defecto + selector de modo oscuro)
- **Drizzle ORM + SQLite / LibSQL (`@libsql/client`)** (archivo local en desarrollo o Turso en producción cambiando `DATABASE_URL`)
- **Better Auth** (hashing `scrypt`, cookies `HttpOnly` + `SameSite=Lax` + `Secure` en producción, sesiones revocables en base de datos y rate limiting en login/registro)
- **Zod** para validación de entradas en todos los endpoints y **Vitest** para tests de dominio

## Seguridad y modelo de datos

- Cada usuario tiene su propia cuenta y solamente puede editar o borrar **su propio** puntaje y reseña.
- Las relaciones de amistad requieren solicitud y aceptación (`friendship`), y solo se puede sumar amigos confirmados a un grupo (`food_group` + `group_member`).
- Todos los endpoints de lugares, fotos y puntajes verifican sesión y pertenencia al grupo en el servidor.
- Las fotos subidas validan tamaño (hasta 5 MB) y firma binaria real (JPG, PNG, WebP o AVIF), y solo las pueden ver miembros del grupo.
- Si definís `INVITE_CODE` en `.env`, el registro de cuentas nuevas exige ese código con comparación en tiempo constante.

## Deploy con Docker

```bash
cp .env.example .env
# Configurar BETTER_AUTH_SECRET y BETTER_AUTH_URL
docker compose up -d --build
```

## Cómo correrlo en local

1. Copiar variables de entorno y generar una clave segura:

```bash
cp .env.example .env
# Editá BETTER_AUTH_SECRET con: openssl rand -hex 32
```

2. Instalar dependencias, crear las tablas y cargar los datos iniciales (cuentas de Fer y Juli, amistad, grupo "Fer y Juli" y los 14 lugares):

```bash
npm install
npm run db:setup
```

3. Iniciar el servidor de desarrollo:

```bash
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

## Comandos útiles

- `npm run dev` inicia Next.js en desarrollo.
- `npm run build` compila para producción.
- `npm run typecheck` valida tipos con TypeScript estricto.
- `npm test` corre los tests unitarios con Vitest.
- `npm run db:push` sincroniza el esquema Drizzle con la base de datos.
- `npm run db:seed` crea las cuentas iniciales (si no existen), el grupo "Fer y Juli" y los lugares precargados.
