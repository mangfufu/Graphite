param(
  [Parameter(Mandatory = $true)]
  [string]$IconPng,

  [Parameter(Mandatory = $true)]
  [string]$HorizontalPng,

  [string]$OutDir = "branding"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

function New-Directory([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path | Out-Null
  }
}

function Get-PngBytes([System.Drawing.Image]$Image) {
  $stream = New-Object System.IO.MemoryStream
  try {
    $Image.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
    return $stream.ToArray()
  } finally {
    $stream.Dispose()
  }
}

function Save-ResizedPng([string]$SourcePath, [string]$DestPath, [int]$Width, [int]$Height) {
  $source = [System.Drawing.Image]::FromFile($SourcePath)
  try {
    $bitmap = New-Object System.Drawing.Bitmap($Width, $Height)
    try {
      $bitmap.SetResolution(96, 96)
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      try {
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.DrawImage($source, 0, 0, $Width, $Height)
      } finally {
        $graphics.Dispose()
      }
      $bitmap.Save($DestPath, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $bitmap.Dispose()
    }
  } finally {
    $source.Dispose()
  }
}

function Save-SvgWrapper([string]$PngPath, [string]$DestPath) {
  $bytes = [System.IO.File]::ReadAllBytes($PngPath)
  $base64 = [Convert]::ToBase64String($bytes)
  $image = [System.Drawing.Image]::FromFile($PngPath)
  try {
    $svg = @"
<svg xmlns="http://www.w3.org/2000/svg" width="$($image.Width)" height="$($image.Height)" viewBox="0 0 $($image.Width) $($image.Height)">
  <image href="data:image/png;base64,$base64" width="$($image.Width)" height="$($image.Height)" />
</svg>
"@
    [System.IO.File]::WriteAllText($DestPath, $svg, [System.Text.UTF8Encoding]::new($false))
  } finally {
    $image.Dispose()
  }
}

function Save-Ico([string[]]$PngPaths, [string]$DestPath) {
  $fileStream = [System.IO.File]::Open($DestPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
  try {
    $writer = New-Object System.IO.BinaryWriter($fileStream)
    try {
      $count = $PngPaths.Count
      $writer.Write([UInt16]0)
      $writer.Write([UInt16]1)
      $writer.Write([UInt16]$count)

      $entries = @()
      $offset = 6 + (16 * $count)

      foreach ($path in $PngPaths) {
        $bytes = [System.IO.File]::ReadAllBytes($path)
        $img = [System.Drawing.Image]::FromFile($path)
        try {
          $entries += [PSCustomObject]@{
            Width = $img.Width
            Height = $img.Height
            Bytes = $bytes
            Offset = $offset
          }
          $offset += $bytes.Length
        } finally {
          $img.Dispose()
        }
      }

      foreach ($entry in $entries) {
        $writer.Write([byte]($(if ($entry.Width -ge 256) { 0 } else { $entry.Width })))
        $writer.Write([byte]($(if ($entry.Height -ge 256) { 0 } else { $entry.Height })))
        $writer.Write([byte]0)
        $writer.Write([byte]0)
        $writer.Write([UInt16]1)
        $writer.Write([UInt16]32)
        $writer.Write([UInt32]$entry.Bytes.Length)
        $writer.Write([UInt32]$entry.Offset)
      }

      foreach ($entry in $entries) {
        $writer.Write($entry.Bytes)
      }
    } finally {
      $writer.Dispose()
    }
  } finally {
    $fileStream.Dispose()
  }
}

$resolvedOutDir = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $OutDir))
$iconDir = Join-Path $resolvedOutDir "icon"
$logoDir = Join-Path $resolvedOutDir "horizontal"
$pngDir = Join-Path $resolvedOutDir "png"

New-Directory $resolvedOutDir
New-Directory $iconDir
New-Directory $logoDir
New-Directory $pngDir

$iconMaster = Join-Path $iconDir "graphite-icon-master.png"
$logoMaster = Join-Path $logoDir "graphite-horizontal-master.png"
Copy-Item -LiteralPath $IconPng -Destination $iconMaster -Force
Copy-Item -LiteralPath $HorizontalPng -Destination $logoMaster -Force

Save-SvgWrapper -PngPath $iconMaster -DestPath (Join-Path $iconDir "graphite-icon.svg")
Save-SvgWrapper -PngPath $logoMaster -DestPath (Join-Path $logoDir "graphite-horizontal.svg")

$iconSizes = 16, 32, 48, 64, 128, 256, 512, 1024
foreach ($size in $iconSizes) {
  Save-ResizedPng -SourcePath $iconMaster -DestPath (Join-Path $pngDir "graphite-icon-$size.png") -Width $size -Height $size
}

$horizontalWidths = 512, 1024, 2048, 3072
$horizontalImage = [System.Drawing.Image]::FromFile($logoMaster)
try {
  foreach ($width in $horizontalWidths) {
    $height = [int][Math]::Round($horizontalImage.Height * ($width / $horizontalImage.Width))
    Save-ResizedPng -SourcePath $logoMaster -DestPath (Join-Path $pngDir "graphite-horizontal-$width.png") -Width $width -Height $height
  }
} finally {
  $horizontalImage.Dispose()
}

$icoPngs = @(
  (Join-Path $pngDir "graphite-icon-16.png"),
  (Join-Path $pngDir "graphite-icon-32.png"),
  (Join-Path $pngDir "graphite-icon-48.png"),
  (Join-Path $pngDir "graphite-icon-64.png"),
  (Join-Path $pngDir "graphite-icon-128.png"),
  (Join-Path $pngDir "graphite-icon-256.png")
)
Save-Ico -PngPaths $icoPngs -DestPath (Join-Path $resolvedOutDir "graphite-icon.ico")

Write-Host "Logo assets generated in $resolvedOutDir"
