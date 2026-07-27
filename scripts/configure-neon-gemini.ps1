$ErrorActionPreference = 'Stop'

$projectId = 'young-cloud-55803831'
$branchId = 'br-red-bread-ax1yj1eq'
$jwksUrl = 'https://ep-bitter-union-ax3cclr3.neonauth.c-4.us-east-2.aws.neon.tech/neondb/auth/.well-known/jwks.json'
$repositoryRoot = Split-Path -Parent $PSScriptRoot

$secureKey = Read-Host 'Tempel GEMINI_API_KEY (input disembunyikan)' -AsSecureString
$keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)

try {
  $geminiKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer)

  if ([string]::IsNullOrWhiteSpace($geminiKey)) {
    throw 'GEMINI_API_KEY tidak boleh kosong.'
  }

  Set-Location -LiteralPath $repositoryRoot

  $functions = @(
    @{
      Slug = 'analyzetransaction'
      Source = 'neon/functions/analyze-transaction'
    },
    @{
      Slug = 'transcribevoice'
      Source = 'neon/functions/transcribe-voice'
    }
  )

  foreach ($function in $functions) {
    Write-Host "Deploying $($function.Slug)..."
    & npx.cmd neonctl functions deploy $function.Slug `
      --project-id $projectId `
      --branch $branchId `
      --src $function.Source `
      --runtime nodejs24 `
      --env "NEON_AUTH_JWKS_URL=$jwksUrl" `
      --env "GEMINI_API_KEY=$geminiKey" `
      --wait

    if ($LASTEXITCODE -ne 0) {
      throw "Deployment $($function.Slug) gagal."
    }
  }

  Write-Host 'Selesai. Kedua Neon Function sudah memiliki GEMINI_API_KEY.'
} finally {
  if ($keyPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer)
  }

  Remove-Variable geminiKey -ErrorAction SilentlyContinue
}
