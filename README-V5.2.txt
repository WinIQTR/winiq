BET PROJECT V5.2 - EXACT PREDICTION SELECTION EXPLANATIONS

This package is applied on top of the verified V5.1 project.

It adds an immutable Selection Policy V2 audit for each evaluated match:
- locked production-model/fallback check
- DRAW audit-only policy check
- HIGH or VERY_HIGH reliability check
- minimum 65 data-quality check
- minimum 60% model-probability check

The Predictions > All Matches view shows every available check as passed or
failed. If a match has not entered the 60-day production evaluation window,
the interface truthfully reports that no audit is available yet.

The audit snapshot is written atomically to:
data/production-selection-audit-v5.json

No API key, account identity, password, model weight, or activation setting is
stored. The 20% ML / 80% Poisson Champion and automatic-change locks remain
unchanged.

Install and verify with the PowerShell commands supplied with the download.
