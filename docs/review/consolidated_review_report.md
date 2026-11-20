# Consolidated EGM Review Report

*   **Target:** `docs/DESIGN-v0.2-v0.3.md`
*   **Mode:** Interactive, all rubrics (Stages 5–9)
*   **Dates:** 2026-11-19 – 2026-11-20
*   **Outcome:** All Blockers and Majors resolved; all Nits from Stages 8–9 applied; Stage 7 Nits partly declined (listed in `goldfish_review_report.md`). Design marked **ready to build**.

## Stage summary

| Stage | Report | Blocker | Major | Nit | Resolution | Commit |
|---|---|---|---|---|---|---|
| 5 Initial Zoom Out | `zoom_out_report.md` | 0 | 9 | 6 | Folded into Stage 7 fixes | `77172c4` |
| 6 Comprehension | `comprehension_report.md` | 0 | 7 | 9 | Folded into Stage 7 fixes | `77172c4` |
| 7 Design Critique | `critic_report.md` → `goldfish_review_report.md` | 4 | 17 | many | 26 fixes auto-accepted + E1 (US region); some Nits declined | `5a57bcc` |
| 8 Intermediate Zoom Out | `intermediate_zoom_out_report.md` | 0 | 4 | 4 | Z16–Z22 applied; Z12/Z23 with Stage 9 | `9c244cc`, `cdcd1d8` |
| 9 Implementation Readiness | `implementation_readiness_report.md` | 1 | 10 | 15 | All 26 (I1–I26) applied | this commit |

## Consolidated action items (all done)

### 🔴 Blockers

| Item | Raw findings | Where fixed |
|---|---|---|
| Own off-switch bypassed by forwarded errors | C1 | §1 "Off switch"; item 2 |
| No property allowlist (machine ID could leak) | C2 | G1 allowlist; item 1–2 |
| No Risks section | C3 | "Risks & Mitigations" |
| "Rejected by author" without trade-off or link | C4 | Alternatives A–I; ROADMAP section H |
| Base cache misdescribed as `pageIndexCache` pattern | I1 (K1) | §2b; item 4 |

### 🟡 Majors (grouped by theme)

| Theme | Raw findings | Where fixed |
|---|---|---|
| Telemetry privacy: error text, other extensions' errors, single schema | Z1, Z2, Z11, C5, C6, Z18 | G1; §1; items 1–2 |
| Telemetry robustness: quota, public key, proxies, sender inputs, wire format | C13, C14, Z10, I2, I3 | G1 volume; §1; Risks 1–2, 4; item 2 |
| G2 parity test (jsdom dropped, CSS test + manual check) | Z6, C7, Z17 | §4; Alternative N; item 13 |
| G4 grammar goal measurable and achievable | Z7, C8, Z16, I7 | G4a–c; §3; item 11 |
| Diff-ref and git edge cases | Z3, Z8, C10, C11, Z21, I4, I5, I6 | §2, §2b; items 4–5 |
| 0.3.0 decision rule | Z4, C12 | "Decision point for 0.3.0" |
| Alternatives completeness | Z5, C15, C16 | Alternatives J–N |
| Document structure and links | C17, C18, C19, comprehension items | headings; Additional Resources; F1–F10 table |
| Wording / overclaims / problem statement | C20, C21 | The Problem; Alternatives |
| GIF reaching the Marketplace | Z9, comprehension | G5; Verification Plan |
| Detailed plan alignment and phasing | Z23, Z12, I8 | Build Phases; items 1–22 |
| F5/F8/F9 fixes accurate to code | I9, I10, I11 | items 5, 7, 14 |

### 🟢 Nits
Stage 8 Z19–Z22 and Stage 9 I12–I26 applied. Stage 7 declined Nits are listed in `goldfish_review_report.md`.

## Open items carried into the build

*   ~~PostHog project key~~ — resolved 2026-11-20: EU Cloud project "APEXLang View" (id 359325), key in `src/telemetry.js`.
*   PostHog wire-format field names to be confirmed against PostHog's capture docs in phase 3.
*   26.2 export for G4c (optional before release).
*   Merge `feature/git-diff` → `dev` and any publish still need the author's explicit go-ahead.
