param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectPath,

  [Parameter(Mandatory = $true)]
  [string]$PnpmPath,

  [string]$ExtraArgs = ""
)

$ErrorActionPreference = "Stop"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[Console]::InputEncoding = $utf8NoBom
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom

$resolvedProjectPath = (Resolve-Path -LiteralPath $ProjectPath).Path
$resolvedPnpmPath = (Resolve-Path -LiteralPath $PnpmPath).Path
$packageJsonPath = Join-Path $resolvedProjectPath "package.json"
$dataDirectory = Join-Path $resolvedProjectPath "data"
$logDirectory = Join-Path $resolvedProjectPath "logs\live-poll"
$lockPath = Join-Path $dataDirectory "live-poll.lock"
$latestLogPath = Join-Path $logDirectory "latest.log"
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$historyLogPath = Join-Path $logDirectory "$timestamp.log"
$stdoutPath = Join-Path $logDirectory "$timestamp.stdout.tmp"
$stderrPath = Join-Path $logDirectory "$timestamp.stderr.tmp"

if (-not (Test-Path -LiteralPath $packageJsonPath -PathType Leaf)) {
  throw "package.json was not found in project path: $resolvedProjectPath"
}

New-Item -ItemType Directory -Path $dataDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null

function Write-Utf8Lines {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [AllowEmptyCollection()]
    [AllowEmptyString()]
    [string[]]$Lines,
    [switch]$Append
  )

  if ($Append) {
    [System.IO.File]::AppendAllLines($Path, $Lines, $utf8NoBom)
  }
  else {
    [System.IO.File]::WriteAllLines($Path, $Lines, $utf8NoBom)
  }
}

function Write-LiveLog {
  param(
    [Parameter(Mandatory = $true)]
    [AllowEmptyCollection()]
    [AllowEmptyString()]
    [string[]]$Lines,
    [switch]$Reset
  )

  $Lines | Write-Output

  if ($Reset) {
    Write-Utf8Lines -Path $latestLogPath -Lines $Lines
    Write-Utf8Lines -Path $historyLogPath -Lines $Lines
  }
  else {
    Write-Utf8Lines -Path $latestLogPath -Lines $Lines -Append
    Write-Utf8Lines -Path $historyLogPath -Lines $Lines -Append
  }
}

function Get-LiveLockState {
  param([Parameter(Mandatory = $true)][string]$Path)

  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    return "Missing"
  }

  $lockValues = @{}
  foreach ($line in Get-Content -LiteralPath $Path -ErrorAction SilentlyContinue) {
    $parts = $line -split "=", 2
    if ($parts.Count -eq 2) {
      $lockValues[$parts[0]] = $parts[1]
    }
  }

  $ownerProcessId = 0
  if (-not [int]::TryParse($lockValues["processId"], [ref]$ownerProcessId)) {
    return "Stale"
  }

  try {
    Get-Process -Id $ownerProcessId -ErrorAction Stop | Out-Null
    return "Held"
  }
  catch {
    return "Stale"
  }
}

$lockState = Get-LiveLockState -Path $lockPath
if ($lockState -eq "Held") {
  Write-LiveLog -Reset -Lines @(
    "$(Get-Date -Format o) Live poll skipped because another poll is still running."
  )
  exit 2
}

if ($lockState -eq "Stale") {
  Remove-Item -LiteralPath $lockPath -Force -ErrorAction SilentlyContinue
}

Write-Utf8Lines -Path $lockPath -Lines @(
  "processId=$PID"
  "startedAt=$(Get-Date -Format o)"
)

try {
  Write-LiveLog -Reset -Lines @(
    "$(Get-Date -Format o) LIVE POLL START"
    "Project: $resolvedProjectPath"
    "Command: pnpm run live:poll -- --once $ExtraArgs"
  )

  $argumentList = @(
    "run"
    "live:poll"
    "--"
    "--once"
  )
  if ($ExtraArgs.Trim().Length -gt 0) {
    $argumentList += ($ExtraArgs -split "\s+" | Where-Object { $_.Length -gt 0 })
  }

  $process = Start-Process `
    -FilePath $resolvedPnpmPath `
    -ArgumentList $argumentList `
    -WorkingDirectory $resolvedProjectPath `
    -NoNewWindow `
    -PassThru `
    -Wait `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath

  $stdoutLines = @()
  $stderrLines = @()
  if (Test-Path -LiteralPath $stdoutPath) {
    $stdoutLines = Get-Content -LiteralPath $stdoutPath -ErrorAction SilentlyContinue
  }
  if (Test-Path -LiteralPath $stderrPath) {
    $stderrLines = Get-Content -LiteralPath $stderrPath -ErrorAction SilentlyContinue
  }

  if ($stdoutLines.Count -gt 0) {
    Write-LiveLog -Lines $stdoutLines
  }
  if ($stderrLines.Count -gt 0) {
    Write-LiveLog -Lines $stderrLines
  }

  Write-LiveLog -Lines @(
    "$(Get-Date -Format o) LIVE POLL END"
    "Exit code: $($process.ExitCode)"
  )

  if ($process.ExitCode -ne 0) {
    throw "pnpm run live:poll failed with exit code $($process.ExitCode). See logs\live-poll\latest.log"
  }
}
finally {
  Remove-Item -LiteralPath $lockPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $stdoutPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $stderrPath -Force -ErrorAction SilentlyContinue
}
