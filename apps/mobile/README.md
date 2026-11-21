# @vybora/mobile

Expo (managed workflow + dev client) · React Native · TypeScript · Expo Router ·
TanStack Query · Zustand · Reanimated · NativeWind (tokens from `@vybora/ui`).

**Status:** directory reserved; the app is scaffolded in **Phase 1** of
[`documentation/architecture/ROADMAP.md`](../../documentation/architecture/ROADMAP.md).

Planned route layout (Expo Router):

```
app/
  (auth)/        welcome, sign-in, sign-up, otp, forgot-password
  (tabs)/        home, explore, create, reels, profile     ← bottom navigation
  notifications, messages/[id], ai-studio/*, music/*, communities/*,
  creator/*, settings/*, u/[username], p/[postId], stories/[userId]
src/
  api/           typed client + TanStack Query hooks
  stores/        Zustand (session, player, composer, ui)
  components/    design-system components
  features/      feature modules mirroring API modules
```
