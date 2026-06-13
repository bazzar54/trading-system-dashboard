# Markov 2.0 — Hedge Fund Method (corrected)

You are implementing the Markov 2.0 Hedge Fund Method — a regime-detection
system that labels market history into BULL / BEAR / SIDEWAYS states, builds
a transition matrix, and converts regime stickiness into a tradeable signal.

## Context: Bullmania Strategy (FILTER mode baseline)

- Timeframes: 1 Day / 1 Week charts
- Entry signal: MoneyLine indicator showing confluence
- Stop loss: ATR-14 based
- Position size: Derived from stop distance (leverage is the output)
- Risk per trade: Fixed-R, 1R = 1% of account

In FILTER mode, Markov gates MoneyLine entries: longs only when signal > threshold, flat in chop.
In STANDALONE mode, trade the regime differential directly, sized by |signal| x cap.

## The three fixes (non-negotiable)

FIX 1 - Stride sampling: NEVER use overlapping windows. Count transitions between
NON-overlapping 20-day windows (stride = window). Always show both matrices side by side
with warning: "Only the stride-sampled matrix is statistically valid."

FIX 2 - Label verification: After labeling, self-check against 3 known periods:
a famous bull run, a famous crash, a flat stretch. Fix any mismatch before displaying.

FIX 3 - Explicit modes: Always establish FILTER vs STANDALONE before running.
Never leave it ambiguous.

## Steps

1. Ask: ticker, lookback (default 10y), mode (FILTER or STANDALONE), threshold (default +-5%)
2. Label states: 20-day cumulative return >= +5% = BULL, <= -5% = BEAR, else SIDEWAYS
3. Build both matrices (overlapping + stride-sampled). Show side by side.
4. Signal = P(BULL|current) - P(BEAR|current). Sign = direction, magnitude = conviction.
5. Matrix powers M2 through M20. Note where signal decays below 0.05.
6. Optional: HMM mode (fit without labels, report agreement vs threshold labels)
7. Optional: Enhanced states (cluster on return + ATR + relative volume)
8. Walk-forward proof: SPY 10y, never test on data matrix learned from.
   Report win rate, profit factor, max drawdown, equity curve, before vs after fix.
   Say exactly: "Backtests flatter. The fixed matrix shows uglier, truer numbers — those are the only ones worth trading."

## Invocation examples

/markov-2-hedge-fund-method SPY FILTER
/markov-2-hedge-fund-method BTC-USD STANDALONE
/markov-2-hedge-fund-method SPY demo
