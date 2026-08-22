# Persist verified resolutions safely

Change record version: 1

Issue: `.scratch/conversational-tracking-specs/issues/09-verified-resolution-foundation.md`

## Summary

Defines the versioned verified-resolution boundary and file-backed API repository for confirmed before-and-after tracking evidence.

## Why

Future similarity retrieval needs trustworthy resolved cases without treating chat content as training data or allowing stored cases to change deterministic verdict rules.

## Behavior

A verified resolution requires human confirmation, a controlled cause and corrective action, a linked non-passing before run, and a linked passing after run. Storage derives only allowlisted environment attributes from normalized run evidence and ignores submitted values, cookies, credentials, arbitrary page text, and unknown input fields.

## Regression coverage

The API persistence test consumes every case in `tests/acceptance/verified-resolution-foundation.json`, reopens the stored file to prove retrieval, rejects incomplete or inconsistent evidence, checks both input and stored-collection schema handling, scans persisted JSON for privacy sentinels, and confirms the deterministic verdict output is unchanged.

## Verification

`npm run verify` passes with 100 deterministic tests and 22 Chromium workflows. The focused fixture-contract and API repository lane contains 14 passing tests.

## Exploratory review

This slice has no user-visible surface. Review is limited to persistence semantics, file contents, privacy boundaries, and automated regression evidence.

## Documentation

Updated Issue 09 and its acceptance fixture. The existing `Verified resolution` glossary term remains authoritative; no new domain synonym or ADR is needed.
