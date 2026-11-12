# 研报撰写工作台 · research-report-workbench

一个跑在 [DeepSeek Harness](https://github.com/deepseek-ai) 左侧栏里的投研工作台：把研报拆成可引用的段落、卡片和图表资产，再把它们装配成行业报告。

面向买方研究场景（PE/VC/公募），资料与数据库都在本机；PDF 解析、五板块摘要和图表重写调用宿主配置的默认模型。

## 功能

- **资料台账**：上传 `txt / md / docx / pdf`、粘贴正文、抓取用户给定的网页（含公众号文章 URL）。
- **PDF 文本清洗**：pdfjs 按坐标还原行；合并竖排标题，剔除页眉页脚、分析师姓名/工号/邮箱、图表目录页，以及图表内部的坐标轴文字。
- **PDF 圈选**：阅读台直接显示 PDF 页（页面图 + 透明文字层），拖选文字后在中间「研读问答」里回答，带 `[bN]` 证据。
- **自动图表库**：上传/重新解析 PDF 时，按「图表 N：标题」到「资料来源」定位图表，2 倍渲染裁剪为 PNG；按上传文档归档到「图表库」，可复制、预览、删除。
- **五板块摘要**：行业逻辑与框架、技术原理、商业逻辑、财务框架与预测、技术发展前景；每张卡带段落证据，确认后才入库。
- **驳回与重写**：驳回时填写原因，AI 按原因重写该卡。
- **图表工坊**：自动提取漏掉的图表可手动拖框截取；数据表可从 Excel/PDF 粘贴、在线改数、改图注。
- **撰写台**：新建报告、编辑正文、插入已确认卡片、插入图表/数据表、维护大纲与字数。
- **文档文件夹**：知识库卡片与图表都按上传文档分组，左侧文件夹可按文档筛选。

## 安装

### 从 GitHub Release（推荐）

1. 在仓库的 **Releases** 下载 `research-report-workbench-0.11.0.tgz`。
2. 安装：

```powershell
dsh plugin add C:\path\to\research-report-workbench-0.11.0.tgz
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
dsh plugin add .\research-report-workbench-0.11.0.tgz
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
# 上传 research-report-workbench-0.11.0.tgz
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
lib/extract.js   DOCX/PDF 零依赖兜底
lib/client.js    左栏图标 + 主面板（React.createElement，无构建）
```

## License

MIT
