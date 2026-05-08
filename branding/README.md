# Graphite Logo Assets

当前目录是 Graphite logo 的交付资产包。

## 目录结构

- `icon/graphite-icon-master.png`
  图标母版，透明背景。
- `icon/graphite-icon-system.png`
  系统图标优化源图。
  说明：在不改造型的前提下做了更紧的有效区域裁切，当前 `ico`、favicon、Tauri 平台图标和应用内 64px 图标都基于它导出。
- `icon/graphite-icon.svg`
  SVG 交付版。
  说明：当前是基于母版 PNG 的 SVG wrapper，可直接在支持 SVG 的场景使用，但本质仍是位图嵌入。
- `horizontal/graphite-horizontal-master.png`
  横版 logo 母版，透明背景。
- `horizontal/graphite-horizontal.svg`
  横版 SVG 交付版。
  说明：同样是基于 PNG 的 SVG wrapper。
- `png/graphite-icon-16.png`
- `png/graphite-icon-32.png`
- `png/graphite-icon-48.png`
- `png/graphite-icon-64.png`
- `png/graphite-icon-128.png`
- `png/graphite-icon-256.png`
- `png/graphite-icon-512.png`
- `png/graphite-icon-1024.png`
  App 图标与桌面端常用位图规格。
- `png/graphite-horizontal-512.png`
- `png/graphite-horizontal-1024.png`
- `png/graphite-horizontal-2048.png`
- `png/graphite-horizontal-3072.png`
  横版 logo 常用位图规格。
- `graphite-icon.ico`
  Windows ICO 图标文件。

## 已同步到项目

这些文件已经同步覆盖到 `src-tauri/icons/` 的主图标入口：

- `source.svg`
- `icon.ico`
- `icon.png`
- `32x32.png`
- `64x64.png`
- `128x128.png`
- `128x128@2x.png`

## 使用建议

- 应用图标优先使用：
  - `graphite-icon.ico`
  - `png/graphite-icon-1024.png`
- 官网、启动页、README 横版展示优先使用：
  - `horizontal/graphite-horizontal-master.png`
  - `png/graphite-horizontal-2048.png`
- 小尺寸场景只用图标，不用横版字标。

## 生成脚本

- 脚本位置：
  [build-logo-assets.ps1](/E:/claude_proj/graphite/scripts/build-logo-assets.ps1)
- 用途：
  从图标母版和横版母版重新导出整套资产。
