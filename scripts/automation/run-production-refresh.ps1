param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectPath,

  [Parameter(Mandatory = $true)]
  [string]$PnpmPath
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
$logDirectory = Join-Path $resolvedProjectPath "logs\production-refresh"
$lockPath = Join-Path $dataDirectory "production-refresh.lock"
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

function Write-RefreshLog {
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

function Get-RefreshLockState {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

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

  $ownerProcess = Get-Process -Id $ownerProcessId -ErrorAction SilentlyContinue

  if (-not $ownerProcess) {
    return "Stale"
  }

  $lockWrittenUtc = (Get-Item -LiteralPath $Path).LastWriteTimeUtc

  try {
    $ownerStartedUtc = $ownerProcess.StartTime.ToUniversalTime()
  }
  catch {
    return "Stale"
  }

  if ($ownerStartedUtc -gt $lockWrittenUtc.AddMinutes(1)) {
    return "Stale"
  }

  return "Active"
}

if (Test-Path -LiteralPath $lockPath -PathType Leaf) {
  $lockState = Get-RefreshLockState -Path $lockPath

  if ($lockState -eq "Active") {
    $message = "$(Get-Date -Format o) Refresh skipped because another refresh process is still running."
    Write-RefreshLog -Lines @($message)
    exit 2
  }

  $staleMessage = "$(Get-Date -Format o) Removed a stale refresh lock whose owner process is no longer running."
  $staleMessage | Write-Output
  Remove-Item -LiteralPath $lockPath -Force
}

Set-Content -LiteralPath $lockPath -Value @(
  "startedAt=$(Get-Date -Format o)"
  "processId=$PID"
  "projectPath=$resolvedProjectPath"
)

try {
  Set-Location -LiteralPath $resolvedProjectPath

  $header = @(
    "============================================================"
    "BET PROJECT AUTOMATIC PRODUCTION REFRESH"
    "Started: $(Get-Date -Format o)"
    "Project: $resolvedProjectPath"
    "============================================================"
  )

  Write-RefreshLog -Lines $header -Reset

  $commandLine = "/d /s /c `"`"$resolvedPnpmPath`" run refresh`""
  $refreshProcess = Start-Process `
    -FilePath $env:ComSpec `
    -ArgumentList $commandLine `
    -WorkingDirectory $resolvedProjectPath `
    -NoNewWindow `
    -Wait `
    -PassThru `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath

  $capturedOutput = New-Object System.Collections.Generic.List[string]

  if (Test-Path -LiteralPath $stdoutPath -PathType Leaf) {
    foreach ($line in [System.IO.File]::ReadAllLines($stdoutPath, $utf8NoBom)) {
      $capturedOutput.Add($line)
    }
  }

  if (Test-Path -LiteralPath $stderrPath -PathType Leaf) {
    $capturedError = [System.IO.File]::ReadAllLines($stderrPath, $utf8NoBom)

    if ($capturedError.Count -gt 0) {
      $capturedOutput.Add("")
      $capturedOutput.Add("# STDERR")

      foreach ($line in $capturedError) {
        $capturedOutput.Add($line)
      }
    }
  }

  if ($capturedOutput.Count -gt 0) {
    $capturedLines = $capturedOutput.ToArray()
    Write-RefreshLog -Lines $capturedLines
  }

  $refreshExitCode = $refreshProcess.ExitCode
  $footer = @(
    "============================================================"
    "Finished: $(Get-Date -Format o)"
    "Exit code: $refreshExitCode"
    "============================================================"
  )

  Write-RefreshLog -Lines $footer

  if ($refreshExitCode -ne 0) {
    throw "pnpm run refresh failed with native exit code $refreshExitCode. Review the captured output above."
  }

  exit 0
}
catch {
  $exceptionDetail = $_ | Out-String
  $errorMessage = @(
    "============================================================"
    "FAILED: $(Get-Date -Format o)"
    $exceptionDetail.TrimEnd()
    "============================================================"
  )

  Write-RefreshLog -Lines $errorMessage
  exit 1
}
finally {
  Remove-Item -LiteralPath $stdoutPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $stderrPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $lockPath -Force -ErrorAction SilentlyContinue
}
