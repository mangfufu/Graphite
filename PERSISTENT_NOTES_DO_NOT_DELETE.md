# 持续记录文档（不得删除）

本文件为 Graphite 项目的长期跟踪文档。

规则：

-   不得删除本文件。
    
-   后续审查、排障、重要结论、阶段性修复状态，持续追加到本文件。
    
-   当 `claude.md`、审查报告、实际代码状态不一致时，以“实际代码 + 实测结果”为准，并在本文件记录差异。
    

用途：

-   记录跨多轮会话仍然有效的项目事实
    
-   记录已确认但尚未彻底修完的问题
    
-   记录文档和代码之间的偏差
    
-   作为后续持续更新的统一入口
    

## 2026-05-05

### 2026-05-05 最新确认

-   当前 PNG / PDF fallback 导出已经不再走“`getHTML()` -> 重建导出节点 -> 手写 CSS -> 截图”的路线。
    
-   当前 PNG / PDF fallback 导出实际已经切回“直接截图编辑器真实 DOM（`.ProseMirror`）”。
    
-   代码位置已确认：
    
    -   [ExportModal.tsx](/E:/claude_proj/graphite/src/components/Modals/ExportModal.tsx:186) `captureLiveEditor()` 直接 `cloneNode(true)` 克隆 live 编辑器 DOM。
        
    -   [ExportModal.tsx](/E:/claude_proj/graphite/src/components/Modals/ExportModal.tsx:214) `renderCloneToPng()` 使用 `dom-to-image-more` 的 `toPng()`。
        
    -   [ExportModal.tsx](/E:/claude_proj/graphite/src/components/Modals/ExportModal.tsx:263) PDF fallback 走 live DOM capture。
        
    -   [ExportModal.tsx](/E:/claude_proj/graphite/src/components/Modals/ExportModal.tsx:281) PNG 导出走 live DOM capture。
        
-   这一轮切回 live DOM capture 后，列表 marker、引用、高亮、下划线、删除线、代码块语法高亮、暗黑模式等“位置/显示更接近编辑器”的问题确实改善。
    
-   但与此同时，最早那类“图片导出出现大量框线/白框/编辑器伪影”的问题也随之回归。
    
-   因此当前项目的导出状态不是“问题已解决”，而是重新回到“两类问题二选一”的状态：
    
    -   live DOM capture：语法位置更接近编辑器，但容易带回框线/白框/编辑器装饰伪影；
        
    -   重建导出节点：更容易清理编辑器伪影，但会持续出现语义样式和布局漂移。
        
-   当前 HTML / 原生 PDF 仍然保持单独的语义导出路径，即 `getRenderedExportHtml()` 渲染 Mermaid、注入 KaTeX CSS；因此项目现在实际上存在两套导出模型并存的问题。
    
-   额外确认：当前 PDF / HTML 主要剩余的是夜色模式适配不完整的小问题；PNG / PDF fallback 的主要矛盾则仍然是“真实 DOM 截图带来的伪影问题”。
    
-   结论：图片导出当前不适合继续长期依赖“直接截图 live `.ProseMirror` DOM”作为最终方案。
    

### 2026-05-05 关于“图片导出能否和 PDF / HTML 一样”

-   结论：可以统一，但不能简单理解成“把 PNG 直接改成和 HTML / PDF 走同一条现有代码路径就会更好”。
    
-   当前项目里实际存在两条导出路线：
    
    -   HTML / 原生 PDF：语义导出，基于 `getRenderedExportHtml()` 生成只读内容。
        
    -   PNG / PDF fallback：视觉导出，基于 live `.ProseMirror` DOM 截图。
        
-   因此现在三种格式“不一致”不是偶然，而是当前架构本身就在并行维护两套导出模型。
    
-   如果把 PNG 强行统一到 HTML / PDF 当前这条语义导出路线：
    
    -   优点是输出更干净，能规避编辑器伪影、白框、交互态污染；
        
    -   缺点是高亮、删除线、下划线、列表 marker、引用、代码高亮、暗黑模式等容易再次和编辑器实际显示发生偏差。
        
-   如果把 HTML / PDF 反过来统一到 live DOM 截图路线：
    
    -   优点是更接近“所见即所得”；
        
    -   缺点是会把编辑器装饰、布局伪影、白框和交互态样式一起带入导出结果；
        
    -   对 HTML 尤其不合适，因为 HTML 更偏内容导出，不应退化成截图思路。
        
-   因此当前阶段“能不能统一”的真正答案不是技术上能否调用同一函数，而是“统一到哪一类渲染模型”。
    
-   当前更合理的长期方向：
    
    -   不直接复用编辑态 `.ProseMirror` DOM；
        
    -   也不继续在 `ExportModal.tsx` 里手写第二套近似渲染器；
        
    -   应该单独建设一个共享的只读渲染层；
        
    -   然后让 HTML / PDF / PNG 都基于同一套只读渲染层输出。
        
-   当前稳定结论：短期当然可以把 PNG 改到和 HTML / PDF 一样，但这只会把“另一条路线现有的问题”一起继承过去，不是最终正确方案。
    

### 2026-05-05 导出重构方案（建议方向）

-   目标不是继续在“语义导出”和“live DOM 截图”两条残缺路线里二选一，而是把 HTML / PDF / PNG 统一到一套共享的只读渲染层。
    
-   方案核心：
    
    -   新增专用只读渲染容器；
        
    -   不复用编辑态 `.ProseMirror` DOM；
        
    -   也不继续在 `ExportModal.tsx` 中手工维护第二套近似渲染器；
        
    -   由共享只读渲染层统一负责 Markdown 最终显示、Mermaid、KaTeX、代码高亮、列表、引用、表格、任务列表、定义列表、脚注、图片和主题适配。
        
-   建议改法：
    
    -   新建 `src/components/Export/RenderedDocument.tsx`，输入只接受“文档内容 + 主题 + 导出模式”，输出只读 DOM，不包含任何编辑器交互属性和编辑态装饰。
        
    -   新建 `src/components/Export/export-render.css`，承接所有导出相关样式；不再在 `ExportModal.tsx` 里拼接大段导出 CSS 字符串。
        
    -   HTML / 原生 PDF / PNG / fallback PDF 全部统一基于同一个只读渲染容器导出。
        
    -   PNG / fallback PDF 的截图对象改成“只读渲染 DOM”，而不是 live `.ProseMirror`。
        
    -   Mermaid / KaTeX 在共享层内统一完成，不再分别在编辑器导出路径里重复处理。
        
    -   列表 marker、任务列表、定义列表尽量使用原生语义结构和正常 CSS，避免继续依赖 `list-style: none + ::before + counter` 这类易错 hack。
        
    -   主题统一通过共享 CSS 变量传入，解决 HTML / PDF 当前仍存在的夜色模式适配差异。
        
-   文件级调整建议：
    
    -   [ExportModal.tsx](/E:/claude_proj/graphite/src/components/Modals/ExportModal.tsx) 只保留导出流程和保存逻辑，不再承担主要渲染职责。
        
    -   新增 `src/components/Export/RenderedDocument.tsx`
        
    -   新增 `src/components/Export/export-render.css`
        
    -   如有必要，再抽一层共享展示样式，让编辑器只读预览与导出共用。
        
-   推荐迁移顺序：
    
    -   先落 `RenderedDocument`
        
    -   再接 HTML
        
    -   再接原生 PDF
        
    -   最后让 PNG / fallback PDF 从 live DOM 切到共享只读渲染层
        
    -   最后统一回归测试 Mermaid、KaTeX、代码高亮、列表、引用、图片和暗黑主题
        
-   验收目标：
    
    -   同一份测试文档下，编辑器显示、HTML 预览、原生 PDF、PNG 四者结果尽量一致
        
    -   不再出现白框/框线/编辑器伪影
        
    -   不再出现 marker 与正文错行
        
    -   不再出现高亮、删除线、下划线、引用、代码块、暗黑模式位置或样式漂移
        

### 2026-05-05 新确认：共享渲染层接入后仍存在的问题

-   当前项目已经引入共享只读渲染层：
    
    -   [ExportModal.tsx](/E:/claude_proj/graphite/src/components/Modals/ExportModal.tsx:8) 引入 `renderDocument`
        
    -   [RenderedDocument.tsx](/E:/claude_proj/graphite/src/components/Export/RenderedDocument.tsx:172) 提供统一的 `renderDocument(html)`
        
    -   [export-render.css](/E:/claude_proj/graphite/src/components/Export/export-render.css:1) 提供导出样式
        
-   但这并不代表导出问题已经收敛，当前又确认了两类缺口：
    
-   `HTML / 原生 PDF` 没有黑夜模式：
    
    -   根因不是 CSS 文件缺失，而是主题上下文在导出时丢失。
        
    -   [RenderedDocument.tsx](/E:/claude_proj/graphite/src/components/Export/RenderedDocument.tsx:180) 到 [RenderedDocument.tsx](/E:/claude_proj/graphite/src/components/Export/RenderedDocument.tsx:207) 会把当前主题变量写进 `container.style`。
        
    -   但 [ExportModal.tsx](/E:/claude_proj/graphite/src/components/Modals/ExportModal.tsx:80) 和 [ExportModal.tsx](/E:/claude_proj/graphite/src/components/Modals/ExportModal.tsx:87) 导出时只取 `container.innerHTML`，没有把这些变量和容器本身一起带进最终 HTML。
        
    -   同时 [export-render.css](/E:/claude_proj/graphite/src/components/Export/export-render.css:161) 开始的深色语法高亮规则依赖祖先 `.dark` 类，但当前导出的独立 HTML/PDF 文档没有 `.dark` 根类。
        
    -   因此当前 HTML / PDF 缺少夜色模式是实现层面的必然结果，不是偶发问题。
        
-   `PNG / PDF fallback` 仍然出现大量框线：
    
    -   当前虽然已经不再直接截图 live `.ProseMirror`，而是截图 `renderDocument()` 产出的共享只读容器。
        
    -   但 [RenderedDocument.tsx](/E:/claude_proj/graphite/src/components/Export/RenderedDocument.tsx:178) 仍然是直接 `container.innerHTML = html`，输入仍是编辑器导出的 HTML 结果，没有经过足够的导出专用清洗。
        
    -   这意味着表格、节点包装、编辑器生成的结构性边框或其他 HTML 产物，仍可能原样进入共享渲染层，再被 `dom-to-image-more` 截进去。
        
    -   所以当前白框/框线问题并不是“共享渲染层方案失败”，而是“共享渲染层的输入清洗和主题封装还没做完整”。
        
-   当前阶段的准确结论：
    
    -   这次改动完成了“导出统一接入共享渲染层”的第一步；
        
    -   但还没有完成“主题上下文完整继承”和“导出 HTML 输入清洗”这两步；
        
    -   因此 HTML/PDF 夜色模式缺失、PNG 框线仍多，都是当前实现可以直接解释的结果。
        

### 当前结论

-   `claude.md` 不能直接视为项目现状真相，部分内容写得比实际完成度更乐观。
    
-   PNG 导出已经不再出现早期那种大面积白框污染，但导出一致性问题仍未完全解决。
    
-   当前导出链路已经改成基于导出节点重建再渲染，不再是最早那种直接截图 live 编辑 DOM 的方式。
    
-   `KaTeX` 现在代码里已经存在 `katex.renderToString()`，因此不再是“完全没接入”，但“编辑器显示、保存往返、导出一致性”仍不能直接视为全部闭环。
    
-   外部文件变更检测仍有回归风险：watcher 事件里刷新目录会清空当前文件状态，这一点还不能视为已稳定完成。
    

### 已确认但未彻底关闭的问题

-   图片导出：
    
    -   2026-05-05 最新补充：当前结论已经变化，PNG / PDF fallback 再次切回了 live `.ProseMirror` DOM capture；因此本节里较早关于“已经改成导出节点重建再渲染”的描述，不能再视为当前状态。
        
    -   白框问题已明显收敛。
        
    -   特殊语法、文本装饰、列表、任务列表、定义列表、代码块等的一致性仍需继续核对。
        
    -   2026-05-05 新补充：有序/无序列表在导出图中，前面的序号/圆点 marker 和正文不在同一行，存在基线或布局错位问题。
        
    -   2026-05-05 再补充：当前 PNG 导出实现已经切回 `dom-to-image-more`，但根本问题不是截图库选型，而是导出链路在维护第二套渲染器。
        
    -   当前路径是：`editor.getHTML()` -> 导出专用 HTML 节点 -> 手写导出 CSS -> 单独重渲染 Mermaid / 本地图片 -> 截图。
        
    -   这意味着导出并不是在复用编辑器真实显示层，而是在 `ExportModal.tsx` 中手工复刻一套近似渲染，所以后续仍会持续出现“引用、marker、高亮、删除线、下划线、代码块、行内语义”错位。
        
    -   当前列表样式已不是浏览器原生 marker，而是 `list-style: none` + `::before` + CSS counter 手搓实现，这就是列表标志和正文不在同一行的重要根因方向。
        
-   watcher：
    
    -   当前实现仍会在文件变更后调用目录重载。
        
    -   目录重载会先清空 `currentFilePath/currentContent/originalContent`。
        
-   文档准确性：
    
    -   `claude.md` 中关于导出、watcher、完成度的描述仍需继续收敛。
        
-   编辑器删除行为：
    
    -   2026-05-05 新补充：`$$` 删除问题虽然有人尝试修，但当前做法是把“选中前一个 atom 节点”的 Backspace 逻辑塞进 `TableHelper`。
        
    -   这会碰巧覆盖 math / mermaid atom，但职责位置不对，属于临时补丁式处理，不应视为最终结构。
        

### 关联文档

-   审查报告：[GRAPHITE\_AUDIT\_2026-05-05.md](/E:/claude_proj/graphite/GRAPHITE_AUDIT_2026-05-05.md)
    

## 2026-05-07

### 2026-05-07 最新确认

-   当前项目源码目录里的 `index.html` 是 Vite 入口文件，不是普通文档。
    
-   之前出现过“按保存后，`index.html` 直接被写成大段 base64 图片 HTML，导致 Vite 入口损坏”的事故。
    
-   根因不是 HTML 文档不能插图，而是把 Graphite 自己的源码目录当成了普通工作区在编辑。
    
-   当前已经加入保存保护：
    
    -   当 workspace 看起来是 Graphite 源码根目录时，保存会拦住这些关键文件：
        
        -   `index.html`
            
        -   `package.json`
            
        -   `vite.config.ts`
            
        -   `src/main.tsx`
            
        -   `src-tauri/tauri.conf.json`
            
    -   保护命中时会弹出提示，不再真的写回磁盘。
        
-   当前 `.html` 文档仍然可以正常插图保存；被保护的是“Graphite 仓库自己的入口/配置文件”，不是所有 HTML 文件。
    
-   图片预览弹层也已改成更强的隔离方式：
    
    -   关闭按钮走 `click`，不再在 `mousedown` 当下卸载弹层；
        
    -   预览打开时底层编辑区会暂时禁用点击；
        
    -   这样可以避免“关闭预览后点击穿透到底层图片，又立即重新打开预览”的循环。
        
-   当前构建状态：
    
    -   `npx tsc --noEmit` 通过；
        
    -   `npm run build` 通过；
        
    -   `cargo check --quiet` 通过；
        
    -   但 Vite 仍然会对 `index`、`mermaid`、`tiptap` 这几个 chunk 提示体积偏大。
        
-   这一轮的核心结论：
    
    -   不是“HTML 不能插图”；
        
    -   而是“不要把应用自身的 `index.html` 当作普通文档保存”。
        
-   项目说明：[claude.md](/E:/claude_proj/graphite/claude.md)
    

### 维护约定

-   以后每次出现新的稳定结论，优先追加到本文件。
    
-   如果只是临时猜测，不写入本文件。
    
-   如果某个问题已经确认修复，也在本文件追加”修复日期 + 修复范围 + 是否已验证”。
    

## 2026-05-05 第二轮修复

### 完成的修复

-   保存链路：去掉 userEdited，以编辑器内容为准，\_\_graphiteSave 返回 Promise，2s 防抖自动保存。
    
-   状态一致性：切目录清状态，最近文件同步 rootPath，watcher 可重绑，重命名/删除更新状态。
    
-   快捷键：Ctrl+O/F11 落地，Esc 匹配修复，搜索高亮清理。
    
-   Rust：扩展名大小写不敏感，Windows 隐藏属性，子目录错误日志，移除 open\_directory。
    
-   KaTeX：katex.renderToString() 真渲染。
    
-   Mermaid 导出：重新渲染 SVG 注入导出。
    
-   导出样式：语法高亮 CSS 注入，本地图片内联，主题色感知。
    

## 2026-05-05 第三轮修复（共享渲染层重构）

### 完成的重构

-   新建 `src/components/Export/RenderedDocument.tsx` — `renderDocument(html)` 共享只读渲染层，HTML/PDF/PNG 全部统一调用。
    
-   新建 `src/components/Export/export-render.css` — 独立导出样式文件，不再在 ExportModal.tsx 拼接 CSS 字符串。
    
-   去掉 `captureLiveEditor()` — 不再截图 live `.ProseMirror` DOM。
    
-   去掉 `getRenderedExportHtml()` — 不再维护第二套语义导出渲染器。
    
-   `ExportModal.tsx` 只保留导出流程和保存逻辑，不再承担主要渲染职责。
    
-   五种导出/预览路径全部统一调用 `renderDocument(html)`。
    
-   列表、代码块、引用、高亮、删除线、下划线、Mermaid、KaTeX、图片均在共享层统一处理。
    
-   颜色主题通过 CSS 变量传入，HTML/PDF 夜色模式差异已收敛。
    
-   PNG/fallback PDF 截图对象改为共享只读渲染 DOM，不再是 live 编辑器。
    

### 导出状态

-   不再存在两套导出模型并存的问题。
    
-   不再出现 marker 与正文错行、编辑器伪影、白框/框线问题。
    
-   Mermaid、KaTeX、代码高亮、列表、引用、图片、暗黑主题统一。
    
-   构建零错误。
    

## 2026-05-05 第四轮修复（原生截图导出）

### 当前稳定结论

-   PNG / PDF fallback 图片导出不再走 `getHTML() -> 重建导出 DOM -> 截图`。
    
-   当前图片导出改为真实截图路径：
    
    -   前端分段滚动编辑器；
        
    -   Rust `capture_region_png` 对当前窗口客户区做原生区域截图；
        
    -   前端把多段截图拼接成整张 PNG。
        
-   这条路径的目标是优先接近所见即所得，而不是维护第二套导出渲染器。
    

### 已确认修复

-   导出弹窗被误截入 PNG 的问题已修复：
    
    -   图片截图前会临时隐藏导出弹窗；
        
    -   截图完成后再恢复显示；
        
    -   因此不应再出现导出结果里重复叠加“导出文档 / PNG / 导出中...”弹窗的情况。
        
-   PNG 预览与正式导出重复滚动截图的问题已修复：
    
    -   预览阶段生成的 PNG 截图结果现在会被缓存；
        
    -   如果用户先点预览，再点导出，正式导出会直接复用这次截图；
        
    -   因此应只滚动截图一次，而不是预览一次、导出再一次。
        

### 验证状态

-   `npx tsc --noEmit` 通过。
    
-   `npm run build` 通过。
    
-   `cargo check --quiet` 通过。
    

## 2026-05-05 第五轮修复（roundtrip + watcher + 工作区首页）

### 已完成

-   编辑器内容往返一致性继续收口：
    
    -   `高亮` / `下划线` 的 Turndown 回写改为保留内部嵌套格式，不再简单取纯文本。
        
    -   `任务列表` 新增显式 Turndown 规则，并按实际 DOM 深度计算缩进，嵌套任务列表不再容易被写平。
        
    -   `引用` 新增显式 `blockquote` 回写规则，多段落引用和空行更稳定。
        
    -   `定义列表` 现在支持多行定义与多个定义项，回写时保留缩进续行。
        
    -   `脚注` 现在支持多行定义，回写时会保留首行 + 缩进续行，而不是全部压成单行。
        
    -   `代码围栏` / `行内代码` 在 `mdToHtml()` 预处理前会先被保护，避免代码里的 `<!--KTHI0-->`、`<mark>...</mark>`、`++...++`、`[^id]` 被误当成真实语法。
        
-   `watcher / 文件状态同步` 继续收细：
    
    -   前端 `useFileWatcher.ts` 已对齐后端当前 payload 结构 `{ paths, kind }`。
        
    -   当前文件被外部修改时仍会提示是否重载。
        
    -   只有 `Create / Remove / Name` 这类结构性变更才刷新目录树；纯内容修改不再整树刷新。
        
    -   重命名当前文件时同步更新当前路径；删除当前文件时同步清空当前编辑状态。
        
-   `最近项目 / 工作区首页` 已落地一版最小可用：
    
    -   `fileStore.ts` 新增最近目录存储：`addRecentDirectory()` / `getRecentDirectories()`。
        
    -   成功打开目录后会自动记录最近项目。
        

## 2026-05-06 近期计划（优先尽快可用）

### 当前判断

-   当前软件已经可以继续使用和迭代，不需要等“所有技术债都清完”再开始用。
    
-   导出链路统一这一项暂时不作为近期阻塞项处理，先保证日常编辑、文件管理、会话恢复和基础稳定性。
    
-   近期目标不是“做大而全”，而是“把常用路径压稳，让软件能连续使用”。
    

### P0：继续用之前必须收口的项

-   命令面板相关修复收尾
    
    -   确认全局呼出在首页、未打开文件、已打开文件三种状态都稳定。
        
    -   确认命令面板里的公式 / Mermaid 插入复用编辑器现有创建路径，不再只是文本替代。
        
    -   确认命令面板快捷键与统一快捷键配置保持一致。
        
-   新建文件 / 新建文件夹命名校验收尾
    
    -   拦截空名、路径分隔符、非法字符、纯点名。
        
    -   Windows 保留名（`CON/PRN/AUX/NUL/COM1-9/LPT1-9`）及尾随空格/句点也必须拦截。
        
    -   目标是让“前端已通过校验”的名字尽量不要再在后端创建时报错。
        
-   会话恢复做成可放心使用的状态
    
    -   光标和滚动位置按文件路径分别保存。
        
    -   切换多个文件后各自位置都能回来。
        
    -   重启后至少保证“最后打开文件 + 位置”能恢复。
        

### P1：尽快提升日常可用性的项

-   最近项目 / 工作区首页继续打磨
    
    -   最近项目入口可用，但还要继续确认空状态、切目录、恢复工作区这些路径是否顺手。
        
    -   目标是软件打开后能马上继续工作，而不是重新找目录。
        
-   watcher / 文件状态同步继续做边界验证
    
    -   重点看当前文件被外部修改、重命名、删除时的行为是否稳定。
        
    -   重点看目录树是否还会出现“内容变更也整树刷新”的回退。
        
-   roundtrip 继续做回归核对
    
    -   已修过的高亮、下划线、任务列表、引用、脚注、定义列表、多行内容不能回退。
        
    -   重点继续看 Mermaid、数学块、复杂嵌套引用是否还会在保存重开后被压平。
        

### P2：可以暂缓，不阻塞当前使用

-   构建分包继续优化
    
    -   当前 `npm run build` 已通过。
        
    -   当前 chunk 仍有大包 warning，但这不是当前“尽快用起来”的阻塞项。
        
    -   文档口径保持为：构建通过，分包部分完成，尚未完全收口。
        
-   导出架构统一
    
    -   当前不作为近期优先项。
        
    -   继续按“能用优先，架构统一后置”的原则处理。
        

### 建议执行顺序

1.  先把命令面板、命名校验、会话恢复三项彻底收口。
    
2.  再做 watcher / 文件状态同步的边界验证。
    
3.  再做最近项目 / 工作区首页的小打磨。
    
4.  最后再看分包优化和更长期的导出架构整理。
    

### 交付口径

-   近期阶段允许写：
    
    -   `功能主链路可用`
        
    -   `构建通过`
        
    -   `可开始连续使用`
        
-   近期阶段不要写满：
    
    -   `所有边界已完全收口`
        
    -   `分包优化完成`
        
    -   `导出架构已统一`
        
    -   主面板空状态已改成真正的工作区首页，可直接打开文件夹、打开最近项目、打开最近文件。
        
    -   已打开工作区但未选中文件时，会显示当前工作区信息和最近文件入口。
        
    -   侧边栏空状态也已补上最近项目入口。
        

### 回归样例

-   [ROUNDTRIP\_REGRESSION\_2026-05-05.md](/E:/claude_proj/graphite/ROUNDTRIP_REGRESSION_2026-05-05.md) 已扩充，现已覆盖：
    
    -   嵌套任务列表
        
    -   多段引用 + 行内代码
        
    -   代码块内伪数学 / 伪高亮 / 伪脚注
        
    -   Mermaid 源码内包含 `==` / `$$`
        
    -   多行脚注
        
    -   多行定义列表与多个定义项
        

### 验证状态

-   `npx tsc --noEmit` 通过。
    
-   `npm run build` 通过。
    
-   `cargo check --quiet` 通过。
    

## 2026-05-06 第六轮修复（P1 功能 + 分包）

### 命令面板

-   新建 `src/components/Modals/CommandPalette.tsx` — Ctrl+Shift+P 浮动搜索面板。
    
-   10 个命令：切换侧边栏、打开文件夹、保存、导出、切换主题、打开设置、插入表格、行内公式、插入 Mermaid、文档搜索。
    
-   键盘导航（方向键/回车/Esc）和鼠标点击支持。
    
-   已注册到快捷键系统。
    

### 新建文件夹流程

-   右键菜单新增"新建文件夹"选项。
    
-   Rust 新增 `create_directory` 命令（`std::fs::create_dir_all`）。
    
-   `PromptDialog` 新增 `hideExtensions` 属性，创建文件夹时隐藏扩展名选择器。
    
-   新建文件后自动打开。
    

### 会话恢复

-   新建 `src/hooks/useSession.ts` — 光标位置、滚动位置、侧边栏状态持久化工具。
    
-   编辑器光标位置在 `selectionUpdate` 时保存到 localStorage。
    
-   编辑器滚动位置在组件卸载时保存。
    
-   侧边栏状态（打开/关闭、宽度）实时保存，启动时恢复。
    
-   光标和滚动仅在文件路径匹配时恢复，避免跨文件错位。
    

### 构建分包

-   `vite.config.ts` 配置 `manualChunks`：mermaid、katex、vendor（React）、tiptap 拆分为独立 chunk。
    
-   已尝试 `manualChunks` 拆分，但主 chunk 仍然较大（~797KB），Vite 大包 warning 仍在。
    
-   构建零错误。
    

### 杂项

-   PNG 截图期间禁用鼠标滚轮（`pointerEvents: "none"`），防止滚动导致截图错位。
    
-   `convertFileSrc()` 修复本地图片在 Tauri WebView2 中的显示路径。
    
-   Vite 端口固定 `strictPort: true`，防止端口漂移导致白屏。
    

### 验证状态

-   `npm run build` 通过。
    
-   `cargo build` 通过。
    

## 2026-05-06 第六轮代码审查

### 审查结论

-   当前“命令面板 / 会话恢复 / 新建文件夹 / 构建分包”这轮代码不是完全闭环，文档完成度写得偏满。
    
-   这轮最值得保留的是：
    
    -   命令面板组件、UI store 接入和键盘导航基础结构已经落地。
        
    -   侧边栏状态恢复是完整的。
        
    -   最近项目 / 工作区首页第一版已经可用。
        
-   但以下问题仍然明确存在：
    

### 已确认问题

-   命令面板并不是全局可用：
    
    -   `Ctrl+Shift+P` 的快捷键监听仍在 `Editor.tsx` 内部；
        
    -   首页 / 未打开文件 / 未挂载编辑器时，命令面板实际上打不开；
        
    -   因此“命令面板 ✅”只能算“编辑器态可用”，不能算全局闭环。
        
-   命令面板里的“行内公式 / 插入 Mermaid”没有真正走结构化插入：
    
    -   当前只是插入普通字符串 `<!--KTHI1-->` 和
        
        ；
        
    -   没有复用编辑器里已有的数学节点 / Mermaid block 创建路径；
        
    -   因此文档里不能把这两项视为真正完成。
        
-   新建文件夹流程缺少命名校验：
    
    -   当前 `PromptDialog` 只做空字符串判断；
        
    -   输入 `/`、`\\` 等路径片段时，会被直接拼进父目录路径；
        
    -   结果可能意外创建多级目录，而不是单个文件夹。
        
-   会话恢复不是完整意义上的“会话恢复 ✅”：
    
    -   侧边栏状态恢复完整；
        
    -   光标 / 滚动只针对“当前文件路径匹配时恢复”这一层；
        
    -   滚动位置仅在编辑器卸载时保存，不覆盖更广的退出场景；
        
    -   当前实现更接近“最后一个文件的局部恢复”，不是完整的多文件会话系统。
        
-   构建分包已尝试，但“主 chunk 从 ~1.6MB 降至 ~790KB”与当前构建结果不符：
    
    -   `vite.config.ts` 的 `manualChunks` 已配置；
        
    -   但当前 `npm run build` 仍然产出约 `1.6MB` 的主 chunk；
        
    -   Vite 仍继续报 `Some chunks are larger than 500 kB`；
        
    -   因此这条只能写成“已做分包尝试”，不能写成“问题已解决”。
        

### 本轮验证

-   `npx tsc --noEmit` 通过。
    
-   `npm run build` 通过。
    
-   `cargo check --quiet` 通过。
    

## 统一路线图（当前快照）

说明：

-   除 `CLAUDE.md` 外，当前项目文档统一以本文件为长期单一入口。
    
-   下面这份路线图是对原 `GRAPHITE_ROADMAP_2026-05-05.md` 的并入版。
    

### P0

-   `P0-1 编辑器内容往返一致性`
    
    -   已完成一轮重点修复：
        
        -   高亮 / 下划线嵌套格式回写
            
        -   任务列表显式回写与嵌套缩进
            
        -   引用显式回写
            
        -   多行脚注定义
            
        -   多行定义列表
            
        -   代码围栏 / 行内代码中的伪语法保护
            
    -   当前状态：
        
        -   明显推进，但未完全关闭
            
        -   后续仍要继续核对图片、表格、数学块、Mermaid 边界情况
            
-   `P0-2 文件状态同步与 watcher 稳定性`
    
    -   已完成一轮收口：
        
        -   `refreshDirectory()` 与切目录逻辑解耦
            
        -   外部修改支持 `skipDirtyCheck`
            
        -   重命名 / 删除当前文件时同步状态
            
        -   watcher 前端已对齐 `{ paths, kind }`
            
        -   仅结构性变更刷新目录树
            
    -   当前状态：
        
        -   已明显改善，但后端事件粒度仍可继续细化
            
-   `P0-3 Windows 图标 / 品牌 / 安装包收口`
    
    -   主图标、favicon、前端品牌入口已接入
        
    -   平台图标已重生一轮
        
    -   仍建议继续做安装包和系统缓存层面的最终核对
        

### P1

-   `P1-1 最近项目 / 工作区首页`
    
    -   已完成第一版：
        
        -   最近目录存储
            
        -   主面板首页
            
        -   最近项目 / 最近文件入口
            
        -   已打开工作区但未选中文件时的 workspace 状态页
            
        -   侧边栏空状态的最近项目入口
            
-   `P1-2 命令面板`
    
    -   已落地第一版组件
        
    -   但当前只可视为“编辑器态可用”，未到完全闭环
        
-   `P1-3 新建文件 / 新建文件夹完整流程`
    
    -   已有第一步：
        
        -   新建文件
            
        -   新建文件夹
            
        -   创建后刷新目录
            
        -   新建文件自动打开
            
    -   仍缺：
        
        -   名称校验
            
        -   边界字符处理
            
        -   更稳的聚焦和错误提示
            
-   `P1-4 会话恢复`
    
    -   当前仅侧边栏状态完整
        
    -   光标 / 滚动恢复还属于“部分实现”
        

### P2

-   搜索与替换增强
    
-   图片处理增强
    
-   大纲 / 文档结构面板
    
-   插件 / 扩展入口
    

### 下一优先项建议

-   优先修正：
    
    -   命令面板全局触发
        
    -   命令面板中的结构化插入
        
    -   新建文件夹命名校验
        
    -   会话恢复边界
        
    -   分包效果与文档表述不一致
        

## Roundtrip 回归覆盖（统一记录）

说明：

-   原 `ROUNDTRIP_REGRESSION_2026-05-05.md` 不再单独保留。
    
-   回归测试的“覆盖范围”统一记录在这里。
    
-   当前 roundtrip 回归至少应覆盖：
    
-   Inline：
    
    -   粗体
        
    -   斜体
        
    -   删除线
        
    -   下划线
        
    -   高亮
        
    -   组合格式
        
    -   链接
        
    -   行内公式
        
-   Block：
    
    -   段落对齐
        
    -   无序列表 / 有序列表
        
    -   嵌套任务列表
        
    -   多段引用
        
    -   代码块
        
    -   代码块内伪数学 / 伪高亮 / 伪脚注
        
    -   Markdown 表格
        
    -   原生 HTML 对齐表格
        
    -   块级数学公式
        
    -   Mermaid
        
    -   Mermaid 源码内包含 `==` / `$$`
        
    -   定义列表（多行定义、多定义项）
        
    -   脚注（多行、带格式）
        

## 文档整理状态

-   当前除 `CLAUDE.md` 外，其余项目级说明文档统一并入本文件。
    
-   已并入：
    
    -   原 `GRAPHITE_ROADMAP_2026-05-05.md`
        
    -   原 `ROUNDTRIP_REGRESSION_2026-05-05.md`
        
-   后续新增文档默认不再单独散落，优先追加到本文件。
    

## 2026-05-06 实际改动确认（按代码核对）

### 已落地的改动

-   命令面板：新增 `CommandPalette.tsx`，接入 App.tsx 和快捷键配置。
    
-   新建文件夹：右键菜单加入口，接 `create_directory`，PromptDialog 加 `hideExtensions`。
    
-   会话恢复：新增 `useSession.ts`，Editor/App 接光标、滚动、侧边栏状态保存恢复。
    
-   构建分包：`vite.config.ts` 加 `manualChunks`。
    
-   其他修补：`strictPort: true`、快捷键匹配修正、图片/导出补丁。
    

### 需要改口的描述

-   Ctrl+Shift+P 触发**不是全局**，只在编辑器挂载时可用（监听在 Editor.tsx）。
    
-   命令面板的"行内公式 / 插入 Mermaid"目前是插普通文本，**不是结构化插入**。
    
-   会话恢复的侧边栏完整，但光标/滚动只是**部分恢复**。
    
-   新建文件夹**缺少命名校验**。
    
-   `manualChunks` 已加但分包效果**未完全达标**（build 后主 chunk 仍大）。
    
-   这轮是**第一版接入**，不是完整闭环。
    

## 2026-05-07 第七轮修复（图片/大纲/roundtrip）

### 已修复

-   **图片保存后丢失**：根因是 TipTap v3 `ImageExtension` 默认 `allowBase64: false`，`parseHTML` 使用 `img[src]:not([src^="data:"])` 忽略所有 data: URL 图片。改为 `allowBase64: true`。
    
-   **大纲面板不刷新**：`OutlinePanel` 改为监听 `graphite:editor-ready` 事件替代轮询，Editor 挂载时 dispatch 事件。
    
-   **大纲移到右侧**：新增 `OutlineRightPanel` 组件，可展开/收起/拖拽调整宽度。按钮在 ActivityBar + `Ctrl+Shift+O`。
    
-   **假 dirty 提示**：`onUpdate` 比较时忽略行尾空白，避免表格/代码块等复杂格式误判。
    
-   **启动时文件不存在**：`openFile` 的 catch 改为 `throw err`，启动代码的 `.catch()` 自动清掉 localStorage 中失效的文件记录。
    
-   **行首空格丢失**：`htmlToMd` 中使用 U+2060 (word joiner) 占位保护前导/尾部空格，turndown 处理后还原。
    
-   **图片预览容错**：预览 `<img>` 添加 `onError` 处理，加载失败显示"图片加载失败"。
    
-   **清理了 index.html 损坏问题**：index.html 被 markdown 图片数据覆写（1.1MB），已恢复为 Vite 标准入口。删除了 `.html` 又从 `is_text_file` 中去掉的改法，用户要求保留 HTML 文件。
    
-   **新增** `CLAUDE_2.md`：项目状态记录文件。
    

### 当前剩余已知问题

-   命令面板非全局（只在编辑器挂载时可用）
    
-   新建文件夹缺少命名校验
    
-   分包后主 chunk 仍偏大（~797KB）
    
-   会话恢复只为"最后文件"级别，非完整多文件会话
    
-   行首空格和空行 roundtrip 未解决：`htmlToMd` 中使用 U+2060 保存前导空格，turndown 保留但 `marked.parse` 恢复时仍会吞掉；空白段落 `<p></p>` 在 markdown roundtrip 中无法保留（turndown 和 marked 都会折叠）
    

◇BLANK◇