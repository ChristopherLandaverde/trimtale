# Persist verified resolutions safely

Change record version: 1

Issue: `.scratch/conversational-tracking-specs/issues/09-verified-resolution-foundation.md`

## Summary

In progress: defines the versioned verified-resolution boundary and file-backed API repository for confirmed before-and-after tracking evidence.

## Why

Future similarity retrieval needs trustworthy resolved cases without treating chat content as training data or allowing stored cases to change deterministic verdict rules.

## Behavior

A verified resolution requires human confirmation, a controlled cause and corrective action, a linked non-passing before run, and a linked passing after run. Storage derives only allowlisted environment attributes from normalized run evidence and ignores submitted values, cookies, credentials, arbitrary page text, and unknown input fields.

## Regression coverage

The API persistence test consumes every case in `tests/acceptance/verified-resolution-foundation.json`, reopens the stored file to prove retrieval, rejects incomplete or inconsistent evidence, checks schema handling, scans persisted JSON for privacy sentinels, and confirms the deterministic verdict output is unchanged.

## Verification

Focused acceptance and persistence tests pass: 13 tests across the fixture contract and API repository. Full `npm run verify` is pending final documentation review.

## Exploratory review

This slice has no user-visible surface. Review is limited to persistence semantics, file contents, privacy boundaries, and automated regression evidence.

## Documentation

Updated Issue 09 and its acceptance fixture. The existing `Verified resolution` glossary term remains authoritative; no new domain synonym or ADR is needed.
