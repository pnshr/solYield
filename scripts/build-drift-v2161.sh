#!/bin/bash
# Build the official Drift protocol-v2 v2.161.0 program from source.
#
# WHY THIS EXISTS
# ---------------
# The Drift program currently deployed on mainnet
# (dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH, last deploy slot 410633860)
# removed every user-facing instruction: deposit, withdraw, initialize_user,
# initialize_user_stats, and the entire insurance-fund staking instruction
# set all return AnchorError 101 (InstructionFallbackNotFound) when simulated
# against live mainnet. Only admin instructions remain (e.g.
# admin_withdraw_from_insurance_fund_vault, which drained the USDC insurance
# fund vault at slot 410454545). Insurance-fund staking therefore no longer
# exists on mainnet and CANNOT pass a fork test against the deployed binary,
# for any implementation.
#
# The drift-insurance-fund mainnet-fork test instead loads the last released
# open-source binary (protocol-v2 tag v2.161.0, 2026-03-30 — the final
# release before the wind-down deploy) on top of REAL current mainnet account
# state. This script reproduces that binary.
#
# Usage:
#   bash scripts/build-drift-v2161.sh [output_dir]
#
# Requires: git, cargo-build-sbf (ships with Solana/Agave 2.x platform tools).
set -euo pipefail

OUT_DIR="${1:-.mainnet-fork-fixtures}"
SRC_DIR="${DRIFT_SRC_DIR:-/tmp/drift-protocol-v2}"
TAG="v2.161.0"

if [ ! -d "$SRC_DIR/.git" ]; then
  git clone --depth 1 --branch "$TAG" \
    https://github.com/drift-labs/protocol-v2 "$SRC_DIR"
fi

cd "$SRC_DIR"
git fetch --depth 1 origin tag "$TAG" 2>/dev/null || true
git checkout "$TAG" 2>/dev/null || true

# v2.161.0 pins ahash crates whose `stdsimd` feature gate fails to compile on
# the rustc bundled with current platform tools. Pin to the fixed releases.
cargo update -p ahash@0.8.6 --precise 0.8.11 2>/dev/null || true
cargo update -p ahash@0.7.6 --precise 0.7.8 2>/dev/null || true

# Default features (mainnet-beta + no-entrypoint) are the deployable build:
# drift's custom `program_entry` is the only entrypoint; anchor's generated
# entrypoint is compiled out by `no-entrypoint`.
cargo-build-sbf --manifest-path programs/drift/Cargo.toml

mkdir -p "$OLDPWD/$OUT_DIR"
cp target/deploy/drift.so "$OLDPWD/$OUT_DIR/drift-v2.161.0.so"
sha256sum "$OLDPWD/$OUT_DIR/drift-v2.161.0.so"
echo "Built drift v2.161.0 -> $OUT_DIR/drift-v2.161.0.so"
echo "Use with: DRIFT_LOCAL_SO=$OUT_DIR/drift-v2.161.0.so npm run clone:mainnet -- drift"
