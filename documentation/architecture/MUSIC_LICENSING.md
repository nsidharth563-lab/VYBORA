# Music — Licensing Model

**Rule:** a track is playable in VYBORA only if a `Track` row exists with an
active licence whose scope covers the use (reel, story, profile, playlist
streaming), the viewer's region, and the clip length. Enforced server-side when
a post/story is created *and* when it is served (licences can expire).

## Providers (behind `MusicProvider` interface)

| Provider | Source of rights | Status |
|---|---|---|
| `vybora_original` | Artists/rights holders upload audio and accept VYBORA's licence terms (grant for in-app UGC use) | Built in Phase 10 |
| `royalty_free` | A royalty-free library licensed for UGC/social use | Built in Phase 10 |
| `<commercial>` | Label / UGC-music-licensing API under contract | Adapter slot only until a contract exists |

Not allowed: pulling audio from consumer streaming services (Spotify, Apple
Music, YouTube, JioSaavn etc.) for redistribution. Their public APIs may be
used *only* within their terms (e.g. deep-link "listen on…" buttons), never to
attach audio to user content.

## Lyrics
Displayed only from a lyrics provider whose licence covers display; otherwise
the lyrics UI is hidden (`Track.hasLyrics = false`).

## Takedowns
`Track.isActive = false` immediately mutes the audio on all posts using it
(the post remains, with a "audio unavailable" notice). DMCA/copyright reports
use `ReportReason.INTELLECTUAL_PROPERTY`.
