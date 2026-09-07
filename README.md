# Bet Project Windows Automation V14.4

This patch replaces only `scripts/automation`.

## Fixes

- Empty separator lines in captured `pnpm` output are accepted by the UTF-8 log writer.
- The `Write-RefreshLog` empty-string parameter-binding failure is fixed.
- The installer never stops an active refresh task.
- The first scheduled run is awaited and verified before installation reports success.
- Re-running the installer can no longer create a false `0xC000013A` interruption.
- Task execution uses non-interactive hidden Windows PowerShell.
- Native pnpm output is read and written explicitly as UTF-8.
- The status screen distinguishes the Windows task result from the latest refresh log result.
- Stale lock recovery and six-hour scheduling remain enabled.

## Install

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\automation\install-production-refresh-task.ps1
```

Keep the window open until `First run: verified successfully` is displayed.

## Status

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\automation\show-production-refresh-status.ps1
```
