# Arquitectura del frontend

## Capas

1. `src/shared/api/http.ts` encapsula transporte, request ID, token, errores y blobs.
2. `src/shared/api/endpoints.ts` expresa las operaciones del dominio sin acoplarlas a componentes.
3. TanStack Query gestiona caché, carga, error, reintento e invalidación.
4. Los módulos `pages` componen experiencias por audiencia.
5. `ProtectedRoute` aplica acceso por rol en el cliente; FastAPI mantiene la autoridad real.

## Estado

- Estado servidor: TanStack Query.
- Formularios complejos de autenticación y tickets: React Hook Form + Zod.
- Estado efímero de interfaz: `useState` local.
- Sesión: contexto React con persistencia versionada y revalidación.

## Manejo de errores

`ApiError` conserva `status`, `code`, `details` y `requestId`. Las vistas muestran mensajes accionables, distinguen 403 y ofrecen reintento donde corresponde. Un 401 limpia la sesión y deja que la guarda devuelva al ingreso.

## Rendimiento

- Imágenes WebP responsivas.
- Fuentes locales, sin dependencia de CDNs.
- Caché de consultas con `staleTime` de 30 segundos.
- Movimiento desactivable mediante `prefers-reduced-motion`.

## Accesibilidad

- Enlaces para saltar al contenido.
- Navegación semántica y estados `aria-expanded`.
- Foco visible, controles de 44–48 px y contraste AA.
- El sidebar móvil cerrado se retira de la navegación por teclado mediante `visibility`.
- Mensajes de validación y errores usan `role="alert"`.
