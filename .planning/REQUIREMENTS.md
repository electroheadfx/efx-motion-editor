# Requirements: EFX-Motion Editor

**Defined:** 2026-10-12
**Core Value:** Users can import key photographs, arrange them into timed sequences with FX layers, preview in real-time, and export as PNG image sequences — the complete stop-motion-to-cinema pipeline must work end-to-end.

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### SAVE — Display-class Save Token (PKG-06/BKG-09)

- [ ] **SAVE-01**: Display-only background edits (transform/lock) persist across save → close → reopen
- [ ] **SAVE-02**: Display-only photo-reference edits (visible/opacity/transform/lock) persist across save → close → reopen
- [ ] **SAVE-03**: Regression test saves twice (the first save masks the missing token) and fails against the pre-fix token builder

### VID — Video Import Disk-Reference Law

- [x] **VID-01**: Imported video is referenced by absolute `source_path`, never copied into the package
- [x] **VID-02**: `.mce` manifest records video assets (`video_assets` on `MceProject`) and reopens from the source path
- [x] **VID-03**: `videos/` package provisioning retired — no video directory is written

### SND — Document-sound Decode Readiness (SND-07)

- [ ] **SND-01**: Playback never silently skips a clip whose buffer failed to decode — awaits the decode or refuses with a visible error
- [ ] **SND-02**: Export mix never silently drops a clip — an undecodable clip surfaces a diagnostic instead of a bare `continue`

### REL — Release

- [ ] **REL-01**: v1.0.1 version single-source across all five surfaces
- [ ] **REL-02**: Signed/notarized DMG published as GitHub Latest via `efx-motion-release`

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Features

- **FEAT-01**: v1.1.0 phases 54-57 (Preact 11 bump, `efx-paint-host`, `efx-watercolor`, `efx-spectral`) — MINOR milestone, not PATCH scope

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Feature phases (54-57 and beyond) | v1.0.1 is a PATCH release — semver ladder locked 2026-10-12 (PATCH for debt, MINOR for features) |
| Paper pack (10 procedural papers) | Rides with the v1.1.0 watercolour work |
| paint-krita / engine-1 spectral | v1.2.0 milestone, planned only after v1.1.0 closes |
| AI features | v1.3.0 milestone |
| Any `.mce` format change | Debt patch only — no schema evolution |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SAVE-01 | Quick 1 | Pending |
| SAVE-02 | Quick 1 | Pending |
| SAVE-03 | Quick 1 | Pending |
| VID-01 | Quick 2 | Approved (UAT 2026-10-12) |
| VID-02 | Quick 2 | Approved (UAT 2026-10-12) |
| VID-03 | Quick 2 | Approved (UAT 2026-10-12) |
| SND-01 | Quick 3 | Pending |
| SND-02 | Quick 3 | Pending |
| REL-01 | Release | Pending |
| REL-02 | Release | Pending |

**Coverage:**

- v1 requirements: 10 total
- Mapped to quicks/release: 10
- Unmapped: 0 ✓
- Note: v1.0.1 is quicks-only (no GSD phases); "Phase" column names the dispatch unit.

---
*Requirements defined: 2026-10-12*
*Last updated: 2026-10-12 — VID-01/02/03 approved after native UAT (Quick 2, 261012-d6q)*
