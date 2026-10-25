---
date: 2026-10-21
adr-number: 0006
status: Accepted
---

# 0006. Team-recorded switch audio assets

**Status**: Accepted

## Context

The keyboard builder's audio feature needs user-initiated switch/typing samples that are permitted for use and accurately linked to the selected switch. The initial placeholder described by the product spec is not sufficient for final audio. The D3 decision in [issue #5](https://github.com/adhi-bn/WAD2-Project/issues/5#issuecomment-6309756797) confirmed that the team will record original clips from personal mechanical keyboards and that the declared coverage includes Linear, Tactile, and Clicky profiles.

## Decision

- Use the supplied original recordings in `public/switch-audio/`; do not synthesize or substitute generic audio.
- Store each available public sample path on its matching switch catalogue entry and use the selected entry to determine the sample and announced profile.
- Play the clips only after an explicit user action with the Web Audio API. Provide mute and volume controls, visible focus, and announced playing, muted, missing-sample, and playback-error states.
- Link the supplied `gazzew-boba-u4.m4a` recording to Gazzew Boba U4 and `gazzew-boba.m4a` to Gazzew Boba U4T; each catalogue entry uses its matching recording.
- Keep any other unrecorded entry unlinked rather than substituting an unrelated recording.
- Treat the clips as a demo of the declared switch profile, not as a claim of acoustic or engineering accuracy.

## Alternatives Considered

- **Synthesized switch sounds**: Rejected because the agreed final audio is based on permitted or self-owned recordings, with no synthesised-profile commitment.
- **One generic sample for every switch**: Rejected because it would misrepresent the selected switch/profile and conceal missing coverage.
- **HTML audio playback**: Rejected in favour of Web Audio API playback, which provides the agreed volume and mute controls.

## Consequences

- **Positive**: The selected Part determines its recording; available samples are user initiated, controllable, and resilient to missing or invalid files.
- **Negative / Trade-offs**: New switch entries need a verified matching recording or must remain explicitly unavailable. Public recordings are included in the frontend deployment.
- **Neutral / Follow-ups**: Expand recorded coverage only when a matching permitted/self-owned clip is supplied. D3 decision and coverage are recorded in [issue #5](https://github.com/adhi-bn/WAD2-Project/issues/5#issuecomment-6309756797).
