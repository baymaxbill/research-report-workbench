# 研报撰写工作台 · research-report-workbench

一个跑在 [DeepSeek Harness](https://github.com/deepseek-ai) 左侧栏里的投研工作台：把研报拆成可引用的段落、卡片和图表资产，再把它们装配成行业报告。

面向买方研究场景（PE/VC/公募），资料与数据库都在本机；PDF 解析、五板块摘要和图表重写调用宿主配置的默认模型。

## 功能

- **资料台账**：上传 `txt / md / docx / pdf`、粘贴正文、抓取用户给定的网页（含公众号文章 URL）。
- **PDF 文本清洗**：pdfjs 按坐标还原行；合并竖排标题，剔除页眉页脚、分析师姓名/工号/邮箱、图表目录页，以及图表内部的坐标轴文字。
- **PDF 圈选**：阅读台直接显示 PDF 页（页面图 + 透明文字层），拖选文字后在中间「研读问答」里回答，带 `[bN]` 证据。
- **阅读字号**：正文栏 A− / A+，12–24px 可调，默认 15px，并记住上次字号。
- **三栏独立开关**：阅读 / 对话 / 摘要各自可开合；默认只开阅读，AI 摘要完成后自动开摘要，PDF 选区提问时自动开对话。
- **PDF 缩放**：PDF 页支持 50–300% 缩放和「适合宽度」，页面图与透明文字层同步缩放。
- **自动图表库**：上传/重新解析 PDF 时，按「图表 N：标题」到「资料来源」定位图表，2 倍渲染裁剪为 PNG；按上传文档归档到「图表库」，可复制、预览、删除。
- **五板块摘要**：行业逻辑与框架、技术原理、商业逻辑、财务框架与预测、技术发展前景；每张卡带段落证据，确认后才入库。
- **驳回与重写**：驳回时填写原因，AI 按原因重写该卡。
- **图表工坊**：自动提取漏掉的图表可手动拖框截取；数据表可从 Excel/PDF 粘贴、在线改数、改图注。
- **撰写台**：新建报告、编辑正文、插入已确认卡片、插入图表/数据表、维护大纲与字数。
- **文档文件夹**：知识库卡片与图表都按上传文档分组，左侧文件夹可按文档筛选。
- **撰写双模式**：AI 自动生成与自由撰写；生成前可逐张选择资料卡、逐份选择上传文档，也可在用户确认后叠加公开网络检索；报告可保存、改名、改状态、删除。\n- **MOKI 资料库桥接**：从 MOKI 的本地索引导入 PDF/DOCX/TXT/MD；分析后的正文、章节、卡片 JSON、图表 PNG 可导出到 MOKI 的本地文件夹映射。

## MOKI 资料库

研读台只读 MOKI 的 `library.sqlite` 索引，按 `resource_library_items.target` 读取原文件；写回只写 MOKI 的 `local_folder` 真实目录，不写 MOKI 数据库，也不调用它的私有 HTTP API。

- **导入**：学习 → 新建拆解 → MOKI 资料库 → 选文件导入。
- **导出**：阅读台右上「导出 MOKI」→ 选目标文件夹。
- 导出结构：`正文.md`、`章节/*.md`、`卡片.json`、`图表/*.png`、`manifest.json`。
- 写回前需要在 MOKI 里先「添加文件夹」（本地文件夹映射）；MOKI 刷新索引后即可看到。

默认读取 `<DSH_HOME>/moki-library/library.sqlite`，可用 `MOKI_LIBRARY_DB` 覆盖。只支持 MOKI 的 `local_file`（PDF/DOCX/TXT/MD）和 `local_folder`。

## 安装

### 从 GitHub Release（推荐）

1. 在仓库的 **Releases** 下载 `research-report-workbench-0.12.12.tgz`。
2. 安装：

```powershell
dsh plugin add C:\path\to\research-report-workbench-0.12.12.tgz
```

如果 `dsh` 不在 PATH，可以用 DSH 安装目录里的 `resources/runtime/cli/bin/dsh.cmd`。

### 从 npm（发布后）

```powershell
dsh plugin add research-report-workbench
```

### 从源码

```powershell
git clone https://github.com/baymaxbill/research-report-workbench.git
cd research-report-workbench
npm install
npm test
npm pack
dsh plugin add .\research-report-workbench-0.12.12.tgz
```

> 不要把源码目录直接 `dsh plugin add`：宿主会把目录移进 profile。开发时先 `npm pack`，再装 tgz。

## 使用

1. **学习** → 导入 PDF / DOCX / 网页 / 粘贴正文。
2. 打开资料，默认在「PDF 圈选」里读原文；切「文本」看清洗后的正文和底部图表条。
3. 选中一段 → 中间「研读问答」里提问，回答带段落证据。
4. 右栏确认 / 驳回五板块卡片；驳回填原因，AI 重写。
5. 顶部 **图表库** 按文档查看自动提取的图表。
6. **撰写** 新建报告，右栏插入已确认卡片、图表和数据表。

## 数据与隐私

- 数据库：`<DSH_HOME>/invest-workbench/invest.db`（沿用旧目录名，升级不丢数据），可用 `DSH_INVEST_DATA_DIR` 覆盖。
- 图表图片：同目录 `files/asset-*.png`。
- 资料、卡片、报告默认只存在本机；调用模型时只发送当前资料摘录、选中原文或卡片内容。
- 不在仓库里保存 API Key、Cookie、数据库或用户资料。
- 上传文件上限 24MB；扫描件没有文字层，图表可以手动截取。

## 开发

```powershell
npm install
npm test
npm run check
```

测试覆盖 Host HTTP 路由、SQLite、PDF 文本还原、AI 输出解析、图表提取、React 渲染。

## 发布

```powershell
npm login
npm publish --access public
```

GitHub Release 附件用：

```powershell
npm pack
# 上传 research-report-workbench-0.12.12.tgz
```

## 结构

```text
lib/index.js     Host 入口：本地库、/invest/api、AI 服务
lib/db.js        SQLite：sources / cards / assets / reports / qa
lib/api.js       HTTP 路由
lib/parse.js     段落化、网页抓取、本地检索、规则抽取
lib/ai.js        五板块摘要、卡片重写、研读问答
lib/pdftext.js   pdfjs 逐页文本还原与清洗
lib/pageimage.js PDF 页渲染与文字层几何
lib/figures.js   图表自动提取与入库
lib/moki.js      MOKI 资料库只读索引与文件层导出
lib/extract.js   DOCX/PDF 零依赖兜底
lib/client.js    左栏图标 + 主面板（React.createElement，无构建）
```

## 第三方与致谢

本项目的 MOKI 资料库桥接是独立实现，**不包含、也不打包 MOKI 的源代码**；它只读取用户本机的 MOKI 本地索引，并写入用户自行映射的本地文件夹。MOKI 需要用户单独安装。

- **MOKI / dsh-moki-library**
  - 仓库：https://github.com/JKZeng-cell/moki-library-for-dsh
  - License：MIT
  - Copyright (c) 2026 JKZeng
  - 本项目与 MOKI 作者无隶属或背书关系；MOKI 名称仅用于说明兼容对象。

完整 MIT 声明与第三方说明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## License

MIT
