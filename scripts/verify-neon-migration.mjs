// Kept as a compatibility entry point for the original migration workflow.
// Verification now audits live integrity and security instead of comparing
// mutable production data with a one-time row-count snapshot.
import './audit-neon-backend.mjs'
