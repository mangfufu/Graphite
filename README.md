# Graphite

WYSIWYG Markdown 编辑器，基于 Tauri 2 + React 18 + TypeScript + Rust。

![Graphite](./LOGO.png)

## 功能

-   所见即所得编辑，Markdown 语法实时渲染
    
-   **粗体**、*斜体*、***粗斜体***、~~删除线~~、<u>下划线</u>、==高亮==、`行内代码`
    
-   标题 H1-H6、引用、有序/无序列表、任务列表
    
-   表格、代码块（语法高亮）、分割线
    
-   定义列表、脚注（双向跳转）
    
-   链接点击通过 Tauri 打开、图片拖入/粘贴插入
    
-   文件树浏览、大纲面板、搜索替换
    
-   自动保存（可配置）、快捷键自定义
    
-   导出 HTML / PDF / PNG
    
-   暗黑模式、5 种主题变体
    
-   命令面板、会话恢复
    

## 构建

```bash
# 开发
npm run tauri dev

# 构建安装包
npm run tauri build
```

## 语法速查

|     |     |
| --- | --- |
|     |     |
| 输入  | 结果  |
| `**粗体**` | **粗体** |
| `*斜体*` | *斜体* |
| `***粗斜体***` | ***粗斜体*** |
| `~~删除线~~` | ~~删除线~~ |
| `++下划线++` | ++下划线++ |
| `<mark>高亮</mark>` | ==高亮== |
| `` `代码` `` | `代码` |
| `[文字](链接)` | 链接  |
| `# 标题` | 标题 1 |
| `> 引用` | 引用块 |
| `- 列表` | 无序列表 |
| `1. 列表` | 有序列表 |
| `- [x] 任务` | 任务列表 |
| `@@GRAPHITE_SEGMENT_1@@` | 代码块 |
| `---` | 分割线 |
| `术语` + Enter + `: 定义` | 定义列表 |
| `[^1]` + Enter | 脚注引用 |
| `[^1]:` + Enter | 脚注定义 |

## 技术栈

-   **前端**: React 18, TypeScript, TipTap v3 / ProseMirror, Tailwind CSS, Zustand
    
-   **后端**: Tauri 2, Rust
    
-   **渲染**: marked (Markdown), turndown (HTML → Markdown)
    
-   **构建**: Vite, Cargo
    

## 许可

MIT