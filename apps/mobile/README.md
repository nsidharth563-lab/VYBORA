# @vybora/mobile

Expo SDK 58 · React Native 0.88 · TypeScript · Expo Router (file-based, `src/app`) ·
TanStack Query · Zustand · Reanimated 4 · design tokens from `@vybora/ui`.

## Run

```bash
cp .env.example .env            # EXPO_PUBLIC_API_URL defaults to http://localhost:4000
pnpm --filter @vybora/mobile start
```
Press `i` (iOS simulator), `a` (Android emulator) or `w` (web), or scan the QR code with
Expo Go. With the API on `localhost`, the app automatically uses your computer's LAN IP on a
physical device and `10.0.2.2` on the Android emulator (`src/lib/api.ts → resolveApiUrl`).

| Script | What it does |
|---|---|
| `pnpm test` | Jest (jest-expo) — API client, theme, and router-level navigation tests |
| `pnpm typecheck` / `pnpm lint` | `tsc --noEmit` / `expo lint` |
| `pnpm doctor` | `expo-doctor` dependency & config checks |
| `pnpm export:web` | Static web build into `dist/` |
| `node scripts/generate-icons.mjs` | Re-render app icons/splash from `assets/brand/mark.svg` (needs Playwright) |

## Structure

```
src/
  app/                    routes (Expo Router)
    _layout.tsx           fonts, splash, providers (Query, theme), root stack
    (tabs)/               Home · Explore · Create · Reels · Profile (custom tab bar)
    notifications.tsx  messages.tsx  settings.tsx  +not-found.tsx
  components/             Text, Screen, TopBar, IconButton, EmptyState, Segmented, Section, Brand, TabBar
  theme/                  AppThemeProvider + useAppTheme (light/dark/system)
  stores/                 Zustand stores (preferences, persisted with AsyncStorage)
  lib/                    api client (typed errors, timeouts), query client
  hooks/                  data hooks (TanStack Query)
```

## Status (Phase 1)
Working: navigation shell, theming with persisted preference, brand fonts and icons,
API client + live server status in Settings. Feature screens show honest empty states
naming the roadmap phase that delivers them — no dead buttons.
