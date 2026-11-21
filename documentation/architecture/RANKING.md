# Feed & Reels Ranking — v1 (transparent rules)

Goal: explainable ranking now, with the same interfaces later fed by an ML model.

## Pipeline

```
candidate generation → filtering → feature lookup → scoring → diversity re-rank → page
```

| Stage | Following feed | Recommended / Reels | Trending |
|---|---|---|---|
| Candidates | Redis timeline (pushed) + pulled posts of high-follower accounts, last 7 days | Posts from: accounts followed-of-followed, user interests (hashtags/interests), trending pool, community posts | Top `rankScore` posts in last 48 h, per region |
| Filter | VisibilityPolicy, blocked/muted, already seen (Redis bloom per user, 3 days), removed content | same | same + min quality bar |

## Score (v1)

```
score = w_aff  · affinity(viewer, author)        // interactions in last 30d, decayed
      + w_eng  · engagementRate(post)             // (likes + 2·comments + 3·shares + 3·saves) / max(impressions, 50)
      + w_int  · interestMatch(viewer, post)      // overlap of hashtags/interests
      + w_fresh· exp(-ageHours / τ)               // τ = 18h feed, 36h reels
      + w_comp · completionRate(post)             // reels only: avg watch % 
      - w_neg  · negativeSignals(post)            // hides, "not interested", reports
```
Initial weights live in config (`ranking.weights.ts`) and are logged with each
served page so any result can be explained ("why am I seeing this"). Re-rank
applies diversity: ≤ 2 consecutive posts from the same author, mix of formats.

`Post.rankScore` stores the viewer-independent part (engagement + freshness +
negatives) recomputed by the `feed.rescore` job; viewer-dependent parts are
computed at request time from cached features.

## Path to ML
1. Log impressions & outcomes (watch time, like, skip) to analytics with the
   features used — training data from day one.
2. Replace `score()` with a model call behind the same `Ranker` interface;
   A/B via PostHog feature flags.
