# MEI schemas

The RelaxNG schemas the tests validate every MEI file against (`docs/notation.md`, "MEI"): full MEI 5.1 (`mei-all.rng`) and MEI Basic 5.1 (`mei-basic.rng`).

Copied unchanged from [music-encoding/schema](https://github.com/music-encoding/schema), folder `5.1`, commit `27b4bdd`. They are generated from the [MEI source](https://github.com/music-encoding/music-encoding), licensed under the [Educational Community License 2.0](https://opensource.org/licenses/ECL-2.0).

The tests use both; the web app also loads `mei-all.rng`, to check the MEI files edited in Fix MEI (`apps/web/src/meiCheckWorker.ts`). It is listed in the third-party notices (`THIRD_PARTY_NOTICES.md`).
