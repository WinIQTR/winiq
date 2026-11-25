param(
  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$Steps = @(
  @{ Label = "Production refresh"; Script = "refresh"; AllowedExitCodes = @(0, 2) },
  @{ Label = "Data coverage and API quota"; Script = "coverage:production"; AllowedExitCodes = @(0) },
  @{ Label = "Result reconciliation and score alerts"; Script = "reconcile:results-v5"; AllowedExitCodes = @(0) },
  @{ Label = "Upcoming odds import"; Script = "import-odds"; AllowedExitCodes = @(0) },
  @{ Label = "Value Bet archive"; Script = "value-bets"; AllowedExitCodes = @(0) },
  @{ Label = "Production reports"; Script = "reports:production"; AllowedExitCodes = @(0) },
  @{ Label = "Production health"; Script = "health:production"; AllowedExitCodes = @(0) },
  @{ Label = "Controlled learning gate"; Script = "check:learning-gate-v4"; AllowedExitCodes = @(0) },
  @{ Label = "Production backup"; Script = "backup:production"; AllowedExitCodes = @(0) },
  @{ Label = "Backup verification"; Script = "verify:backup"; AllowedExitCodes = @(0) },
  @{ Label = "Membership T-7 expiry reminders"; Script = "notifications:membership-expiry"; AllowedExitCodes = @(0, 1) },
  @{ Label = "Daily net-three member notify"; Script = "notifications:daily-net-three"; AllowedExitCodes = @(0, 1) },
  @{ Label = "Daily ops checklist"; Script = "check:daily-ops"; AllowedExitCodes = @(0, 2) }
)

if ($DryRun) {
  Write-Host "BET PROJECT LOCAL DAILY COLLECTION - DRY RUN"
  Write-Host "Project: $ProjectRoot"
  foreach ($Step in $Steps) {
    Write-Host ("[DRY RUN] pnpm run {0}" -f $Step.Script)
  }
  Write-Host "No command was executed and no file was changed."
  exit 0
}

$PnpmCommand = (Get-Command "pnpm.cmd" -ErrorAction Stop).Source
$OperationsDirectory = Join-Path $ProjectRoot "data\operations"
$LogDirectory = Join-Path $ProjectRoot "logs\production"
$LockPath = Join-Path $OperationsDirectory "local-daily-collection.lock"
$LogPath = Join-Path $LogDirectory ("daily-collector-{0}.log" -f (Get-Date -Format "yyyy-MM-dd"))
$LockStream = $null
$TranscriptStarted = $false

function Import-DotEnvFile([string]$Path, [switch]$Overwrite) {
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return }
  foreach ($line in Get-Content -LiteralPath $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) { continue }
    $separator = $trimmed.IndexOf("=")
    if ($separator -lt 1) { continue }
    $key = $trimmed.Substring(0, $separator).Trim()
    $value = $trimmed.Substring($separator + 1).Trim()
    if (
      ($value.StartsWith('"') -and $value.EndsWith('"')) -or
      ($value.StartsWith("'") -and $value.EndsWith("'"))
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    $existing = [Environment]::GetEnvironmentVariable($key, "Process")
    if (-not $Overwrite -and $existing) { continue }
    Set-Item -Path "Env:$key" -Value $value
  }
}

# Prod Neon + API keys first; then fill missing local-only notify keys (RESEND_*, TELEGRAM_*).
Import-DotEnvFile (Join-Path $ProjectRoot "data\operations\netlify-production.env") -Overwrite
Import-DotEnvFile (Join-Path $ProjectRoot ".env")
$env:DOTENV_CONFIG_PATH = Join-Path $ProjectRoot "data\operations\netlify-production.env"
$env:NODE_ENV = "production"

New-Item -ItemType Directory -Path $OperationsDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $LogDirectory -Force | Out-Null

if (Test-Path $LockPath) {
  $LockAge = (Get-Date) - (Get-Item $LockPath).LastWriteTime
  if ($LockAge.TotalHours -ge 6) {
    Remove-Item $LockPath -Force
  }
}

try {
  $LockStream = [System.IO.File]::Open(
    $LockPath,
    [System.IO.FileMode]::CreateNew,
    [System.IO.FileAccess]::Write,
    [System.IO.FileShare]::None
  )
  $LockText = [System.Text.Encoding]::UTF8.GetBytes(
    ("PID={0}; StartedAt={1}" -f $PID, (Get-Date).ToString("o"))
  )
  $LockStream.Write($LockText, 0, $LockText.Length)
  $LockStream.Flush()

  Start-Transcript -Path $LogPath -Append | Out-Null
  $TranscriptStarted = $true
  Set-Location $ProjectRoot

  Write-Host ""
  Write-Host "BET PROJECT LOCAL DAILY COLLECTION"
  Write-Host ("Started: {0}" -f (Get-Date).ToString("o"))
  Write-Host "Champion: 20% ML / 80% Poisson"
  Write-Host "Automatic model activation: LOCKED"

  foreach ($Step in $Steps) {
    $ScriptName = [string]$Step.Script
    $AllowedExitCodes = [int[]]$Step.AllowedExitCodes
    Write-Host ""
    Write-Host ("STEP: {0}" -f $Step.Label)
    & $PnpmCommand run $ScriptName
    $ExitCode = $LASTEXITCODE
    if ($AllowedExitCodes -notcontains $ExitCode) {
      throw ("Step failed: {0}. Exit code: {1}" -f $Step.Label, $ExitCode)
    }
    if ($ExitCode -eq 2) {
      Write-Warning ("Step completed with warnings: {0}" -f $Step.Label)
    }
  }

  Write-Host ""
  Write-Host ("Completed: {0}" -f (Get-Date).ToString("o"))
  Write-Host "No model weight or production lock was changed."
} catch {
  Write-Error $_
  exit 1
} finally {
  if ($TranscriptStarted) {
    Stop-Transcript | Out-Null
  }
  if ($null -ne $LockStream) {
    $LockStream.Dispose()
  }
  Remove-Item $LockPath -Force -ErrorAction SilentlyContinue
}
