# VYBORA Design System

**Where it lives**
- **Tokens** — `packages/ui` (`@vybora/ui`): palette, light/dark themes, gradients, spacing, radii, typography, motion, plus `contrastRatio()`. Platform-agnostic; shared with the admin dashboard.
- **Mobile components** — `apps/mobile/src/ui` (import from `@/ui`). Built on React Native primitives + Reanimated. The admin dashboard (Phase 14) builds its own web components on the same tokens.
- **Live gallery** — Settings → *Design system* (`/design-system`). Every component, interactive, in both themes.

> Roadmap note: Phase 2 originally said "`@vybora/ui` RN components". Components live in the app instead so `@vybora/ui` stays dependency-free for web/admin use; tokens are still the single source of truth.

## Brand
- **Signal gradient** `#4F46E5 → #8B5CF6 → #FF6B4A` (connect → create → discover). Logo, story rings, decorative surfaces.
- **Signal Strong** `#4F46E5 → #7C3AED → #C2410C` — the gradient for anything carrying text or icons (primary buttons, Create tab). White stays ≥ 4.5:1 at every stop.
- Type: **Sora** (display/titles), **Inter** (UI/body). Both OFL.

## Accessibility rules (enforced by tests)
| Rule | Where enforced |
|---|---|
| Body text ≥ 4.5:1 on every surface, both themes | `packages/ui/src/contrast.test.ts` |
| Muted text, icons, control borders (`borderStrong`) ≥ 3:1 (WCAG 1.4.11) | same |
| Labels on solid status fills (`onSuccess/onWarning/onDanger`) ≥ 4.5:1 | same |
| Avatar initials fills ≥ 4.5:1 with white | `apps/mobile/src/__tests__/ui.test.tsx` |
| Touch targets ≥ 44×44 pt | component styles (`minHeight: 44`, `hitSlop`) |
| Every control has role + label + state (`disabled`, `busy`, `selected`, `checked`) | component tests query by role/name |
| Errors are announced (Android live region, iOS `announceForAccessibility`) | `TextField`, `Toast` tests |
| Motion respects the OS "Reduce motion" setting | `Button`, `Tabs`, `Skeleton`, `Sheet`, `Toast` use `useReducedMotion()` |
| Modal sheets trap screen-reader focus and close via the VoiceOver escape gesture | `Sheet` test |
| Skeletons are hidden from screen readers; wrap in `SkeletonGroup` to announce "Loading" | `Skeleton` test |

Contrast fixes made in this phase (found by the tests): light `primary` #8B5CF6 → #6D28D9 (4.1 → 6.9:1), light `textMuted` #9A9AAB → #717184 (2.7 → 4.6:1), coral gradient stop unusable under white text (2.8:1) → `signalStrong`, dark-mode white-on-red/green fills (3.8 / 2.5:1) → `onDanger`/`onSuccess`.

## Components
| Component | Purpose | Notes |
|---|---|---|
| `Text` | Typography variants `display/title/heading/body/bodyStrong/caption/label`, tones | Sora/Inter mapping |
| `Icon` | Lucide icons at consistent sizes/strokes | Decorative; label the control |
| `Button` | `primary` (gradient) · `secondary` · `outline` · `ghost` · `danger`; `sm/md/lg`; icon; `loading`; `disabled`; `fullWidth` | Press-scale spring, light haptic |
| `IconButton` | Icon-only, 44pt | Requires `label` |
| `TextField` | Label, helper, error, left icon, password reveal, counter, multiline | Error border + announced message |
| `Avatar` | Image or initials; sizes `xs–xl`; story ring `unseen/seen/closeFriends`; verified; online | Composite spoken label |
| `Badge` | Status/count pill (`99+`) | Tones brand/neutral/success/warning/danger |
| `Chip` | Toggle pill (interests, filters) | `togglebutton` role |
| `Card` | Surface; pressable variant | |
| `ListItem` | Settings/menu row with chevron, destructive style | |
| `SwitchRow` | Whole-row switch | Single `switch` element for screen readers |
| `Segmented` | 2–4 option radio group | Theme picker |
| `Tabs` | Underline tabs with animated indicator and counts | `tablist`/`tab` |
| `Skeleton`, `SkeletonGroup` | Loading placeholders | Static under reduce-motion |
| `Spinner` | Short waits | `progressbar` |
| `Sheet` | Bottom sheet modal | Backdrop, Android back, VoiceOver escape |
| `Toast` (`ToastProvider`, `useToast`) | Transient feedback; max 3; errors 6 s, others 3.5 s; tap to dismiss | Announced |
| `EmptyState` | Nothing-here-yet states | Names delivering phase |
| `Screen`, `BrandMark`, `Wordmark` | Layout & brand | |

## Testing notes
- RNTL 14: `render`, `rerender` and every `fireEvent.*` are **async** — always `await` them.
- Reanimated 4.7's shipped Jest mock crashes under jest-expo; `apps/mobile/test/mocks/reanimated.js` is a small explicit mock of the APIs we use (animations resolve instantly). Extend it when a component uses a new Reanimated API — tests fail loudly otherwise.
