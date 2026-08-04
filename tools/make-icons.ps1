# Converts the source WebP sticker into the PNG icon sizes Chrome needs.
# Uses WPF's PresentationCore (System.Windows.Media.Imaging), which decodes
# through the OS's WIC codecs and supports WebP on this machine — unlike
# System.Drawing/GDI+, which never supports WebP regardless of installed
# codecs, and unlike the WinRT Windows.Graphics.Imaging APIs, whose async
# file-write calls deadlock/fault when driven synchronously from PowerShell.
param(
  [string]$SourcePath = "C:\Users\amit\Downloads\44e92aae-2f1b-4a1c-bb5a-a2a38c70dce7.webp",
  [string]$OutDir = (Join-Path $PSScriptRoot "..\icons")
)

Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName System.Drawing

if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir | Out-Null }

$uri = New-Object System.Uri($SourcePath)
$decoder = [System.Windows.Media.Imaging.BitmapDecoder]::Create($uri, [System.Windows.Media.Imaging.BitmapCreateOptions]::None, [System.Windows.Media.Imaging.BitmapCacheOption]::OnLoad)
$frame = $decoder.Frames[0]

foreach ($size in @(16, 48, 128)) {
  $outPath = Join-Path $OutDir "icon$size.png"

  $sx = $size / [double]$frame.PixelWidth
  $sy = $size / [double]$frame.PixelHeight

  $scaled = New-Object System.Windows.Media.Imaging.TransformedBitmap
  $scaled.BeginInit()
  $scaled.Source = $frame
  $scaled.Transform = New-Object System.Windows.Media.ScaleTransform -ArgumentList $sx, $sy
  $scaled.EndInit()

  $encoder = New-Object System.Windows.Media.Imaging.PngBitmapEncoder
  $encoder.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($scaled))

  $fs = [System.IO.File]::Open($outPath, [System.IO.FileMode]::Create)
  try {
    $encoder.Save($fs)
  } finally {
    $fs.Dispose()
  }
  Write-Host "Wrote $outPath ($size x $size)"
}
