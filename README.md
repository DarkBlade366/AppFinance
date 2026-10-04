# Cuentas Claras

Aplicación móvil para llevar el control de finanzas personales (CUP / USD). Permite definir un capital base, registrar ingresos, gastos y cambios de moneda, y visualizar resúmenes mensuales por categoría.

## Visión rápida

- **Nombre:** Cuentas Claras
- **Stack:** Expo (SDK ~57), React Native, TypeScript, expo-router
- **Base de datos local:** SQLite (expo-sqlite) — archivo: `finance.db`

## Requisitos

- Node.js (se recomienda v18+)
- npm o yarn
- Aplicación **Expo Go** instalada en el celular (desde Play Store / App Store)
- NO hace falta Android Studio ni Xcode para probar la app en el celular

## Instalación y ejecución

1. Instalar dependencias

```bash
npm install
```

2. Iniciar el servidor de desarrollo

```bash
npm start
# o, si el celular no está en la misma red Wi-Fi:
npx expo start --tunnel
```

3. Abrir la app en el celular

- Escanear el QR que aparece en la terminal con **Expo Go** (o la app de cámara en iOS).
- Opcional, solo para emuladores locales: `npm run android`, `npm run ios` o `npm run web`.

## Scripts útiles

- `start`: `expo start`
- `lint`: `expo lint`
- `android` / `ios` / `web`: abren la app en emulador/simulador (opcional)
- ⚠️ `reset-project` borraría las pantallas y formularios propios de esta app. No lo uses.

## Estructura del proyecto (resumen)

- [app/](app/): Entrada y rutas basadas en archivos (expo-router). Contiene pantallas y la navegación.
   - [app/_layout.tsx](app/_layout.tsx): Proveedor principal (tema, Base de datos, Toasts) y Stack root.
   - [app/(tabs)/index.tsx](app/(tabs)/index.tsx): Pantalla principal (resumen del capital, conversión, resumen mensual).
   - [app/(tabs)/new.tsx](app/(tabs)/new.tsx): Formulario para crear transacciones.
- [app/(tabs)/history.tsx](app/(tabs)/history.tsx): Historial con filtros por tipo y día, detalles y edición.
- [app/(tabs)/categories.tsx](app/(tabs)/categories.tsx): Gestión de categorías.
- [components/]: Componentes UI reutilizables (cards, formularios, toasts, logo, etc.).
- [assets/]: Imágenes y recursos (logo, favicon, splash).
- [lib/]: Lógica de datos y persistencia.
   - [lib/schema.ts](lib/schema.ts): Definición del esquema, tipos y migraciones (PRAGMA `user_version`).
   - [lib/db.ts](lib/db.ts): API de alto nivel para leer/escribir settings, categorías y transacciones.
   - [lib/db-provider.tsx](lib/db-provider.tsx): Proveedor SQLite y hook de contexto.
- [constants/]: Colores y temas (`constants/theme.ts`).
- [hooks/]: Hooks personalizados (`use-app-colors`, `use-theme-color`, etc.).
- [scripts/reset-project.js](scripts/reset-project.js): Script auxiliar para resetear el proyecto.

## Base de datos y migraciones

- La app usa `expo-sqlite` con un archivo local (`finance.db`).
- Las migraciones están implementadas en [lib/schema.ts](lib/schema.ts) y actualizan `PRAGMA user_version`.
- Estructura principal de tablas: `settings`, `categories`, `transactions`.

## Funcionalidades principales

- Definir capital en CUP (efectivo/transferencia) y USD.
- Registrar transacciones de tipo `income`, `expense` y `exchange` (cambio de moneda), con métodos de pago (efectivo/transferencia).
- Devolver el vuelto de un gasto en dólares como CUP efectivo.
- Ver resumen mensual por moneda y por categoría.
- Historial con filtros por tipo (todos/gastos/ingresos/cambios) y por día.
- Ajustar el "toque" (tasa informal de conversión CUP ↔ USD).

## Instalar la app en el celular (APK)

La app se puede compilar como un `.apk` instalable sin necesidad de Android Studio, usando el **EAS cloud build** de Expo:

```bash
npx eas-cli login
npx eas build --platform android --profile preview
```

Al terminar se genera un enlace de descarga para el `.apk`. Se transfiere al celular (cable, Drive o WhatsApp), se instala y funciona como una app normal, sin depender de Expo Go.

## Dependencias destacadas

Extraídas de `package.json`:

- `expo`: ~57.0.26
- `expo-router`: ~57.0.24
- `expo-sqlite` — persistencia local
- `react` (19.2.3), `react-native` (0.86.3)
- `react-native-reanimated`, `react-native-gesture-handler`
- `@react-navigation/*` para navegación

## Linting y Tipado

- TypeScript está habilitado (`tsconfig.json` extiende `expo/tsconfig.base`, `strict: true`).
- Ejecutar `npm run lint` para revisar problemas de estilo/ESLint.

## Desarrollo y pruebas rápidas

1. Ejecutar la app en un emulador Android:

```bash
npm run android
```

2. Ejecutar la app en el simulador iOS (macOS con Xcode):

```bash
npm run ios
```

3. Web:

```bash
npm run web
```

## Resetear proyecto

El script `npm run reset-project` mueve el ejemplo inicial y deja un `app` vacío. Útil para empezar desde cero si se descargó la plantilla original.

## Consejos y notas de mantenimiento

- El archivo de configuración `app.json` contiene el esquema (`scheme: cuentas-claras`) y plugins (splash screen, expo-router, expo-sqlite).
- Revisar [lib/schema.ts](lib/schema.ts) antes de cambiar la estructura DB: las migraciones son incrementales por `user_version`.
- Si añade integraciones nativas, asegúrese de mantener las versiones compatibles con SDK 57.

## Contribuir

- Abrir issues para bugs o mejoras.
- Hacer PRs con descripciones claras y, si afectan DB, explicar migraciones.

