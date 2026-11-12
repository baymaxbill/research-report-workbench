/* 研读台 · 客户端半边（手写 IIFE + React.createElement，无需构建）
 *
 * 注册：main（keyed，key=invest）+ sidebar.panellist（list，id=invest）
 * 数据：fetch /invest/api/*（Host 侧 lib/api.js）
 * 样式：全部 .dsh-iw 命名空间，动画 iw- 前缀，避免污染宿主。
 */
window.__ModuleLoader__.load({
  id: 'research-report-workbench',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useRef, useCallback } = React

    const PANEL_ID = 'invest'
    const VERSION = '0.11.0'
    const BOARDS = ['行业逻辑与框架', '技术原理', '商业逻辑', '财务框架与预测', '技术发展前景']

    const CSS = `
.dsh-iw{
  --bg:#0A1116; --panel:#0F181F; --panel2:#121F27; --panel3:#16252E;
  --line:#20313C; --line2:#2B4352;
  --ink:#E7F0F3; --muted:#8CA1AC; --dim:#5E747F;
  --teal:#4FB6C6; --teal2:#8FDCE7; --teal-bg:rgba(79,182,198,.12);
  --gold:#C9A45B; --amber:#D9A441; --amber-bg:rgba(217,164,65,.13);
  --ok:#5FBF8F; --ok-bg:rgba(95,191,143,.12);
  --warn:#E0A458; --warn-bg:rgba(224,164,88,.12);
  --risk:#E06C6C; --risk-bg:rgba(224,108,108,.12);
  --paper:#F7F4EC; --paper2:#EFE9DA; --p-ink:#202D33; --p-muted:#6C7A80;
  --p-line:#E1D9C8; --p-hl:#FFF0C4;
  height:100%; min-height:640px; display:flex; flex-direction:column; position:relative;
  background:var(--bg); color:var(--ink); overflow:hidden;
  font-family:"Microsoft YaHei UI","Microsoft YaHei","PingFang SC",sans-serif;
  font-size:13px; line-height:1.55;
}
.dsh-iw *{box-sizing:border-box}
.dsh-iw button{font:inherit;color:inherit;border:0;background:none;cursor:pointer}
.dsh-iw input,.dsh-iw textarea,.dsh-iw select{font:inherit;color:inherit}
.dsh-iw ::-webkit-scrollbar{width:8px;height:8px}
.dsh-iw ::-webkit-scrollbar-thumb{background:#253a45;border-radius:4px}
.dsh-iw ::-webkit-scrollbar-track{background:transparent}

.iw-top{flex:none;height:54px;display:flex;align-items:center;gap:14px;padding:0 16px;
  background:#0B131900; border-bottom:1px solid var(--line); background-color:#0B1319}
.iw-mark{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;font-weight:800;font-size:13px;
  color:#04161B;background:linear-gradient(140deg,#6FD0DE,#2C7C8B);box-shadow:0 0 0 1px rgba(111,208,222,.25)}
.iw-brand{display:flex;flex-direction:column;line-height:1.25}
.iw-brand b{font-size:13.5px;letter-spacing:.03em}
.iw-brand span{font-size:9.5px;color:var(--dim);letter-spacing:.06em}
.iw-proj{display:flex;align-items:center;gap:6px;padding:4px 9px;border:1px solid var(--line);
  border-radius:7px;font-size:10.5px;color:#B9CED5;background:#0D171D;white-space:nowrap}
.iw-proj i{width:6px;height:6px;border-radius:50%;background:var(--teal);box-shadow:0 0 6px var(--teal)}
.iw-tabs{display:flex;gap:2px;margin-left:6px;padding:3px;background:#0D171D;border:1px solid var(--line);border-radius:9px}
.iw-tabs button{padding:5px 13px;border-radius:6px;font-size:11.5px;color:var(--muted)}
.iw-tabs button.on{background:#17262E;color:#E2F4F7;box-shadow:inset 0 0 0 1px #27424E}
.iw-spacer{flex:1}
.iw-pill{display:inline-flex;align-items:center;gap:4px;height:20px;padding:0 7px;border-radius:5px;
  border:1px solid #243844;background:#15232B;color:#A9C0C8;font-size:10px;white-space:nowrap}
.iw-pill.ai{background:var(--amber-bg);border-color:rgba(217,164,65,.3);color:#E8BE78}
.iw-pill.ok{background:var(--ok-bg);border-color:rgba(95,191,143,.28);color:#8ED9B4}
.iw-pill.warn{background:var(--warn-bg);border-color:rgba(224,164,88,.3);color:#EBC28C}
.iw-pill.risk{background:var(--risk-bg);border-color:rgba(224,108,108,.3);color:#E8A3A3}
.iw-pill.teal{background:var(--teal-bg);border-color:rgba(79,182,198,.28);color:#8FDCE7}
.iw-btn{height:27px;padding:0 11px;border-radius:7px;font-size:11px;background:#1A2A33;
  border:1px solid #2A424E;color:#D6E7EB;display:inline-flex;align-items:center;gap:5px;white-space:nowrap}
.iw-btn:hover{background:#21343E}
.iw-btn.primary{background:linear-gradient(180deg,#2E7D8B,#246873);border-color:#3A94A3;color:#EAFBFD;font-weight:600}
.iw-btn.ghost{background:#101A21;border-color:#2A414D;color:#B7CBD2}
.iw-btn.sm{height:23px;padding:0 8px;font-size:10px;border-radius:6px}
.iw-btn:disabled{opacity:.45;cursor:default}
.iw-icon{width:15px;height:15px;flex:none;display:inline-block;vertical-align:-2px}

.iw-main{flex:1;min-height:520px;display:flex;flex-direction:column;overflow:hidden}
.iw-scroll{overflow:auto;min-height:0}
.iw-page{padding:18px 20px 24px;min-height:0}
.iw-h1{font-size:18px;line-height:1.4;margin:0 0 6px;letter-spacing:.01em}
.iw-h2{font-size:13.5px;margin:0;color:#DCEAEE}
.iw-sub{font-size:11.5px;color:var(--muted);margin:0}
.iw-dim{color:var(--dim)}
.iw-row{display:flex;align-items:center;gap:8px}
.iw-grow{flex:1}

.iw-hero{display:flex;align-items:flex-start;gap:18px;padding:18px 20px;border:1px solid var(--line);
  border-radius:12px;background:radial-gradient(120% 160% at 0% 0%,#12222B 0%,#0E181F 60%);margin-bottom:14px}
.iw-hero h1{margin:0 0 7px;font-size:21px;letter-spacing:.01em}
.iw-hero p{margin:0;color:var(--muted);font-size:11.5px;line-height:1.8;max-width:640px}
.iw-hero .iw-actions{margin-left:auto;display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.iw-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px}
.iw-stat{padding:12px 14px;border:1px solid var(--line);border-radius:10px;background:var(--panel)}
.iw-stat b{display:block;font-size:22px;line-height:1.15;letter-spacing:.01em}
.iw-stat span{display:block;font-size:10px;color:var(--dim);margin-top:3px}
.iw-cols{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:12px}
.iw-card{border:1px solid var(--line);border-radius:10px;background:var(--panel);padding:13px 14px}
.iw-card-h{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.iw-card-h b{font-size:12px;color:#DCEAEE}
.iw-list{display:flex;flex-direction:column;gap:0}
.iw-item{display:flex;align-items:center;gap:10px;padding:9px 2px;border-bottom:1px solid #17262E;cursor:pointer}
.iw-item:last-child{border-bottom:0}
.iw-item:hover{background:#101C24}
.iw-item .t{flex:1;min-width:0}
.iw-item .t b{display:block;font-size:11.5px;color:#D5E4E8;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.iw-item .t span{display:block;font-size:9.5px;color:var(--dim);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.iw-empty{padding:26px 16px;text-align:center;color:var(--dim);font-size:11px;line-height:1.9}
.iw-empty b{display:block;color:#B7CBD2;font-size:12px;margin-bottom:4px}

/* learn */
.iw-learn{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:12px;padding:14px 16px}
.iw-panel{border:1px solid var(--line);border-radius:11px;background:var(--panel);display:flex;flex-direction:column;min-height:0}
.iw-panel-h{flex:none;height:42px;display:flex;align-items:center;gap:8px;padding:0 13px;border-bottom:1px solid var(--line)}
.iw-panel-h b{font-size:12px;font-weight:600;color:#DCEAEE}
.iw-table{width:100%;border-collapse:collapse;font-size:11px}
.iw-table th{text-align:left;font-weight:400;color:var(--dim);font-size:9.5px;letter-spacing:.05em;
  padding:8px 12px;border-bottom:1px solid var(--line);background:#0D171D}
.iw-table td{padding:9px 12px;border-bottom:1px solid #16242C;vertical-align:top}
.iw-table tr{cursor:pointer}
.iw-table tbody tr:hover td{background:#101C24}
.iw-table .name{color:#E1EEF1;font-weight:600;font-size:11.5px}
.iw-table .sub{display:block;font-size:9.5px;color:var(--dim);margin-top:2px;font-weight:400}
.iw-import{padding:14px}
.iw-seg{display:flex;gap:2px;padding:3px;background:#0C161C;border:1px solid var(--line);border-radius:8px;margin-bottom:12px}
.iw-seg button{flex:1;padding:5px 6px;border-radius:6px;font-size:10.5px;color:var(--muted)}
.iw-seg button.on{background:#17262E;color:#DFF2F5;box-shadow:inset 0 0 0 1px #27424E}
.iw-field{margin-bottom:10px}
.iw-field label{display:block;font-size:9.5px;color:var(--dim);margin-bottom:4px;letter-spacing:.04em}
.iw-input,.iw-textarea,.iw-select{width:100%;border:1px solid #263C47;border-radius:7px;background:#0B151B;
  color:#D7E7EC;padding:7px 9px;outline:none;font-size:11.5px}
.iw-input:focus,.iw-textarea:focus,.iw-select:focus{border-color:#3C6C7A}
.iw-textarea{resize:vertical;line-height:1.7;min-height:90px}
.iw-drop{border:1px dashed #31505D;border-radius:9px;background:#0B151B;padding:16px;text-align:center;color:var(--muted);font-size:10.5px;cursor:pointer}
.iw-drop:hover{border-color:#4A7C8A;color:#C9DDE2}
.iw-drop b{display:block;color:#D9E9ED;font-size:11.5px;margin-bottom:4px}

/* reader */
.iw-reader{flex:1;min-height:0;display:flex;flex-direction:column;position:relative}
.iw-rhead{flex:none;height:44px;display:flex;align-items:center;gap:10px;padding:0 14px;border-bottom:1px solid var(--line);background:#0D171D}
.iw-rhead .title{font-size:12px;font-weight:600;color:#E1EEF1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:42%}
.iw-rgrid{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,0.95fr) minmax(0,1.15fr) minmax(0,0.85fr);gap:1px;background:var(--line)}
.iw-pane{min-height:0;display:flex;flex-direction:column;background:var(--panel);overflow:hidden}
.iw-paper{background:var(--paper);color:var(--p-ink);min-height:0;display:flex;flex-direction:column;flex:1}
.iw-paper-h{flex:none;padding:12px 16px 10px;border-bottom:1px solid var(--p-line)}
.iw-paper-h h2{margin:0 0 4px;font-size:14px;line-height:1.45;color:#18262C}
.iw-paper-h .meta{font-size:9.5px;color:var(--p-muted);display:flex;gap:6px;flex-wrap:wrap}
.iw-outline{flex:none;max-height:150px;overflow:auto;padding:6px 8px;border-bottom:1px solid var(--p-line);background:var(--paper2)}
.iw-outline button{display:block;width:100%;text-align:left;padding:4px 7px;border-radius:5px;font-size:10px;color:#64747A;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.iw-outline button:hover{background:#FBF8F1;color:#1F5C6B}
.iw-doc{flex:1;min-height:0;overflow:auto;padding:12px 16px 20px;scroll-behavior:smooth}
.iw-block{font-family:"SimSun","宋体",serif;font-size:12.5px;line-height:1.95;color:#2A383E;
  padding:3px 6px;margin:0 -6px 5px;border-radius:4px;cursor:pointer;text-align:justify}
.iw-block:hover{background:#FBF6E8}
.iw-block.heading{font-family:"Microsoft YaHei",sans-serif;font-weight:700;color:#174E5A;font-size:12px;margin-top:10px}
.iw-block.sel{background:var(--p-hl);box-shadow:0 0 0 2px var(--p-hl)}
.iw-block.sel:after{content:"已选中";float:right;font-family:"Microsoft YaHei",sans-serif;font-size:8.5px;color:#8A6A1F;background:#F2D98F;border-radius:3px;padding:0 4px;margin-left:6px}
.iw-chat{flex:1;min-height:0;display:flex;flex-direction:column}
.iw-chat-h{flex:none;height:38px;display:flex;align-items:center;gap:8px;padding:0 12px;border-bottom:1px solid var(--line);font-size:10.5px;color:var(--muted)}
.iw-msgs{flex:1;min-height:0;overflow:auto;padding:12px 12px 0}
.iw-msg{margin-bottom:12px}
.iw-msg .who{font-size:9.5px;color:var(--dim);margin-bottom:5px;display:flex;align-items:center;gap:5px}
.iw-msg.user .who{justify-content:flex-end}
.iw-bubble{background:#111E26;border:1px solid #1F333E;border-radius:10px;padding:9px 11px;font-size:11.5px;line-height:1.8;
  color:#D4E4E9;white-space:pre-wrap;word-break:break-word}
.iw-msg.user .iw-bubble{background:#16262E;border-color:#28424E}
.iw-quote{border-left:2px solid var(--gold);background:rgba(201,164,91,.09);padding:5px 8px;border-radius:0 6px 6px 0;
  font-size:10px;color:#D3BE95;margin-bottom:5px;line-height:1.6}
.iw-ev{display:flex;gap:4px;flex-wrap:wrap;margin-top:7px}
.iw-ev button{font-size:9px;padding:1px 5px;border-radius:4px;background:var(--teal-bg);border:1px solid rgba(79,182,198,.25);color:#8FDCE7}
.iw-ev button:hover{background:rgba(79,182,198,.2)}
.iw-compose{flex:none;margin:8px 10px 10px;border:1px solid #24404B;background:#0D171E;border-radius:10px;padding:8px 9px}
.iw-compose .ctx{display:flex;align-items:center;gap:5px;margin-bottom:6px;font-size:9px;color:var(--dim);flex-wrap:wrap}
.iw-compose textarea{width:100%;border:0;background:transparent;outline:none;resize:none;min-height:38px;max-height:110px;
  color:#D7E7EC;font-size:11.5px;line-height:1.6}
.iw-compose .bar{display:flex;align-items:center;gap:6px;margin-top:4px}
.iw-compose .bar .hint{font-size:9px;color:var(--dim)}
.iw-assets{flex:1;min-height:0;display:flex;flex-direction:column}
.iw-assets-h{flex:none;height:38px;display:flex;align-items:center;gap:4px;padding:0 10px;border-bottom:1px solid var(--line)}
.iw-assets-h button{padding:4px 7px;border-radius:5px;font-size:10px;color:var(--muted)}
.iw-assets-h button.on{background:#17262E;color:#DFF2F5}
.iw-cards{flex:1;min-height:0;overflow:auto;padding:8px 10px}
.iw-cardlet{border:1px solid #1E313C;border-radius:9px;background:#101B22;padding:9px 10px;margin-bottom:7px}
.iw-cardlet .top{display:flex;align-items:center;gap:5px;margin-bottom:4px}
.iw-cardlet .board{font-size:8.5px;color:var(--dim);letter-spacing:.04em}
.iw-cardlet h4{margin:0 0 5px;font-size:11px;line-height:1.55;color:#DCEAEE;font-weight:600}
.iw-cardlet p{margin:0;font-size:9.5px;line-height:1.65;color:#8FA6AF;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.iw-cardlet .meta{display:flex;align-items:center;gap:6px;margin-top:6px;font-size:9px;color:var(--dim)}
.iw-cardlet .acts{display:flex;gap:4px;margin-top:6px}
.iw-cardlet .acts button{font-size:9px;padding:2px 6px;border-radius:4px;background:#15242C;border:1px solid #223742;color:#A9C2CA}
.iw-cardlet .acts button:hover{border-color:#33505C}
.iw-cardlet .acts button.ok{color:#8ED9B4;border-color:rgba(95,191,143,.3)}
.iw-points{margin:5px 0 0;padding-left:14px;color:#A9C0C8;font-size:9.5px;line-height:1.65}
.iw-points li{margin-bottom:2px}
.iw-gap{margin-top:5px;font-size:9px;color:#E0B374;background:rgba(224,164,88,.08);border-radius:4px;padding:3px 6px;line-height:1.5}
.iw-cardlet .acts button.no{color:#E8A3A3;border-color:rgba(224,108,108,.28)}

/* write */
.iw-write{flex:1;min-height:0;display:grid;grid-template-columns:220px minmax(0,1fr) 300px;gap:1px;background:var(--line)}
.iw-side{background:var(--panel);display:flex;flex-direction:column;min-height:0}
.iw-side-h{flex:none;height:40px;display:flex;align-items:center;gap:6px;padding:0 10px;border-bottom:1px solid var(--line);font-size:10.5px;color:var(--muted)}
.iw-rep-list{flex:1;min-height:0;overflow:auto;padding:6px}
.iw-rep{width:100%;text-align:left;padding:8px;border-radius:7px;border:1px solid transparent;margin-bottom:4px}
.iw-rep:hover{background:#101C24}
.iw-rep.on{background:#132129;border-color:#27424E}
.iw-rep b{display:block;font-size:10.5px;color:#D5E4E8;line-height:1.5;margin-bottom:2px}
.iw-rep span{font-size:9px;color:var(--dim)}
.iw-editor{background:var(--panel);display:flex;flex-direction:column;min-height:0}
.iw-ed-bar{flex:none;height:40px;display:flex;align-items:center;gap:6px;padding:0 12px;border-bottom:1px solid var(--line);font-size:10px;color:var(--dim)}
.iw-ed-title{flex:none;padding:10px 16px 8px;background:var(--paper);border-bottom:1px solid var(--p-line)}
.iw-ed-title input{width:100%;border:0;background:transparent;outline:none;font-size:16px;font-weight:700;color:#18262C}
.iw-ed-title .meta{display:flex;align-items:center;gap:6px;margin-top:3px;font-size:9.5px;color:var(--p-muted)}
.iw-ed-body{flex:1;min-height:0;background:var(--paper);padding:0}
.iw-ed-body textarea{width:100%;height:100%;border:0;outline:none;resize:none;background:transparent;
  padding:14px 18px 24px;font-family:"SimSun","宋体",serif;font-size:13px;line-height:2;color:#25333A}
.iw-ed-empty{flex:1;display:grid;place-items:center;background:var(--paper);color:var(--p-muted);text-align:center;font-size:11px}
.iw-refs{flex:1;min-height:0;overflow:auto;padding:8px}

/* library */
.iw-lib{flex:1;min-height:0;display:flex;flex-direction:column;padding:14px 16px}
.iw-filters{display:flex;gap:5px;margin-bottom:10px}
.iw-filters button{padding:4px 10px;border-radius:6px;font-size:10.5px;color:var(--muted);border:1px solid transparent}
.iw-filters button.on{background:#17262E;color:#DFF2F5;border-color:#27424E}
.iw-lib-table{flex:1;min-height:0;overflow:auto;border:1px solid var(--line);border-radius:10px;background:var(--panel)}
.iw-lib-row{display:grid;grid-template-columns:110px minmax(0,1fr) 120px 90px;gap:10px;align-items:start;
  padding:10px 12px;border-bottom:1px solid #16242C;font-size:11px;cursor:pointer}
.iw-lib-row:hover{background:#101C24}
.iw-lib-row .b{font-size:9.5px;color:var(--dim)}
.iw-lib-row .tt{color:#D8E7EB;line-height:1.55}
.iw-lib-row .src{font-size:9.5px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.iw-lib-row .st{text-align:right}
.iw-lib-detail{grid-column:1/-1;padding:8px 10px;margin-top:6px;background:#0C161C;border-radius:7px;font-size:10px;color:#9FB6BF;line-height:1.7}
.iw-lib-detail b{color:#C9DDE2}

.iw-fatal{margin:16px;padding:16px 18px;border:1px solid rgba(224,108,108,.4);border-radius:10px;
  background:#1A1114;color:#F0C9C9;font-size:12px;line-height:1.8;min-height:300px}
.iw-fatal b{display:block;color:#F3A7A7;font-size:13px;margin-bottom:8px}
.iw-fatal pre{white-space:pre-wrap;word-break:break-word;background:#120C0E;border:1px solid #3A2226;
  border-radius:7px;padding:8px 10px;font-size:10.5px;color:#E8B4B4;max-height:260px;overflow:auto}
.iw-modal-mask{position:absolute;inset:0;background:rgba(4,8,10,.55);display:grid;place-items:center;z-index:30}
.iw-modal{width:430px;background:#101C24;border:1px solid #2A414D;border-radius:12px;padding:16px 18px;
  box-shadow:0 24px 60px rgba(0,0,0,.5)}
.iw-modal h3{margin:0 0 6px;font-size:13.5px;color:#E4F1F4}
.iw-modal p{margin:0 0 10px;font-size:10.5px;color:var(--muted);line-height:1.7}
.iw-modal textarea{width:100%;height:86px;border:1px solid #2A414D;border-radius:8px;background:#0B151B;
  color:#D7E7EC;padding:8px 10px;outline:none;resize:none;font-size:11.5px;line-height:1.7}
.iw-modal .row{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}
.iw-modal.wide{width:920px;max-width:94%}
.iw-crop{position:absolute;border:1px solid #4FB6C6;background:rgba(79,182,198,.18);pointer-events:none}
.iw-preview-table{width:100%;border-collapse:collapse;font-size:10px;color:#26333A}
.iw-preview-table th{background:#EFE9DA;text-align:left;padding:5px 7px;border-bottom:1px solid #E0D8C6;font-weight:600}
.iw-preview-table td{padding:4px 7px;border-bottom:1px solid #EFE9DA}
.iw-asset{display:flex;gap:10px;padding:10px;border-bottom:1px solid #16242C}
.iw-asset img{width:120px;height:78px;object-fit:contain;background:#fff;border:1px solid #22353F;border-radius:6px;flex:none}
.iw-asset .info{flex:1;min-width:0}
.iw-asset .info b{display:block;font-size:11.5px;color:#DCEAEE;margin-bottom:3px}
.iw-asset .info p{margin:0;font-size:9.5px;color:#8FA6AF;line-height:1.6;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.iw-asset .acts{display:flex;gap:4px;margin-top:6px;flex-wrap:wrap}
.iw-rp{display:flex;flex-direction:column;height:100%;min-height:0;background:var(--bg);color:var(--text)}
.iw-rp-h{display:flex;align-items:center;gap:7px;padding:8px 10px;border-bottom:1px solid var(--line);background:#0E1A21;flex:none}
.iw-rp-h b{font-size:11.5px;color:#DCEAEE}
.iw-rp-doc{flex:1;min-height:0;overflow:auto;user-select:text;padding:12px 14px 140px;background:var(--paper);color:#26333A;font-size:11.5px;line-height:1.85}
.iw-rp-block{margin:0 0 8px;cursor:text}
.iw-rp-block.heading{font-weight:700;color:#173D4A;margin-top:14px;font-size:12px}
.iw-rp-block::selection{background:#BFE6EC}
.iw-rp-bar{flex:none;border-top:1px solid var(--line);background:#0E1A21;padding:8px 10px}
.iw-rp-bar .q{font-size:9.5px;color:#A9C0C8;line-height:1.55;max-height:52px;overflow:auto;margin-bottom:6px}
.iw-rp-bar .q span{color:#6FB9C8}
.iw-rp-bar textarea{width:100%;height:48px;resize:none;border:1px solid #2A414D;border-radius:6px;background:#0B151B;color:#D7E7EC;padding:6px 8px;font-size:11px;line-height:1.6;outline:none}
.iw-rp-bar .row{display:flex;align-items:center;gap:6px;margin-top:5px}
.iw-rp-bar .hint{font-size:9px;color:var(--dim)}
.iw-rp-note{padding:6px 10px;font-size:9.5px;color:#8FDCE7;background:rgba(79,182,198,.08);border-top:1px solid #1E3640}
.iw-figstrip{flex:none;border-top:1px solid var(--line);background:#FBF7EE;padding:6px 8px}
.iw-figstrip .h{font-size:9px;color:#6C7A80;margin-bottom:4px}
.iw-figstrip .row{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px}
.iw-figstrip a{flex:none;width:110px;text-decoration:none}
.iw-figstrip img{width:110px;height:70px;object-fit:cover;border:1px solid #DDD5C4;border-radius:5px;background:#fff;display:block}
.iw-figstrip span{display:block;font-size:8.5px;color:#5D6A70;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
.iw-pdfv{flex:1;min-height:0;display:flex;flex-direction:column;background:#0B151B}
.iw-pdfv-bar{display:flex;align-items:center;gap:5px;padding:6px 8px;border-bottom:1px solid var(--line);background:#0E1A21;flex:none}
.iw-pdfv-scroll{flex:1;min-height:0;overflow:auto;padding:10px 12px 160px;background:#E9E5DC;text-align:center}
.iw-pdfv-page{position:relative;display:inline-block;max-width:100%;background:#fff;box-shadow:0 2px 12px rgba(0,0,0,.18)}
.iw-pdfv-page img{display:block;max-width:100%;height:auto;user-select:none}
.iw-pdfv-text{position:absolute;inset:0;overflow:hidden;user-select:text;cursor:text}
.iw-pdfv-text span{position:absolute;color:transparent;white-space:pre;line-height:1;transform-origin:0 0;user-select:text}
.iw-pdfv-text span::selection{background:rgba(79,182,198,.35);color:transparent}
.iw-pdfv-empty{margin:24px auto 0;max-width:520px;padding:12px 14px;border:1px dashed #B9B3A6;border-radius:8px;color:#5D6A70;font-size:11px;line-height:1.8;background:#F7F3EA}
.iw-pdfv-send{flex:none;border-top:1px solid var(--line);background:#0E1A21;padding:7px 9px}
.iw-pdfv-send .q{font-size:9.5px;color:#A9C0C8;line-height:1.55;max-height:48px;overflow:auto;margin-bottom:5px}
.iw-pdfv-send textarea{width:100%;height:44px;resize:none;border:1px solid #2A414D;border-radius:6px;background:#0B151B;color:#D7E7EC;padding:5px 8px;font-size:11px;line-height:1.6;outline:none}
.iw-pdfv-send .row{display:flex;align-items:center;gap:6px;margin-top:4px}
.iw-pdfv-send .hint{font-size:9px;color:var(--dim)}
.iw-pdfv-note{padding:5px 9px;font-size:9.5px;color:#8FDCE7;background:rgba(79,182,198,.08);border-top:1px solid #1E3640}
.iw-toast{position:absolute;left:50%;bottom:20px;transform:translateX(-50%);background:#13232C;border:1px solid #2E4A56;
  color:#DCEBEF;padding:7px 13px;border-radius:8px;font-size:11px;box-shadow:0 10px 30px rgba(0,0,0,.4);z-index:20}
.iw-error{margin:0 0 10px;padding:8px 10px;border:1px solid rgba(224,108,108,.35);background:var(--risk-bg);
  color:#E8B0B0;border-radius:7px;font-size:10.5px;display:flex;gap:8px;align-items:center}
.iw-skel{height:9px;border-radius:4px;background:#1A2B34;margin:6px 0;animation:iw-pulse 1.2s ease-in-out infinite}
@keyframes iw-pulse{50%{opacity:.55}}
.iw-busy{font-size:10px;color:var(--teal2)}
@media (max-width:1100px){
  .iw-rgrid{grid-template-columns:minmax(0,1fr) minmax(0,1.1fr)}
  .iw-rgrid .iw-pane.assets{display:none}
  .iw-write{grid-template-columns:190px minmax(0,1fr)}
  .iw-write .iw-side.refs{display:none}
}

/* ===== Harness theme bridge: surfaces and text follow host tokens ===== */
.dsh-iw{
  --bg:var(--dsw-alias-bg-base,#F6F2E9);
  --panel:var(--dsw-alias-bg-layer-1,#FFFFFF);
  --panel2:var(--dsw-alias-bg-layer-2,#F2EEE4);
  --panel3:var(--dsw-alias-bg-overlay,#FAF7EF);
  --line:var(--dsw-alias-border-l1,#E3DCCD);
  --line2:var(--dsw-alias-border-l2,#D2C8B6);
  --ink:var(--dsw-alias-label-primary,#1F2A2E);
  --muted:var(--dsw-alias-label-secondary,#66757B);
  --dim:var(--dsw-alias-label-secondary,#8A979C);
  --teal:var(--dsw-alias-brand-primary,#1F6F7E);
  --teal2:var(--dsw-alias-brand-primary,#155B68);
  --teal-bg:rgba(31,111,126,.10);
  --gold:#A07A2E;
  --amber:var(--dsw-alias-state-warn-primary,#A66A16);
  --amber-bg:rgba(166,106,22,.10);
  --ok:var(--dsw-alias-state-success-primary,#2E7D5B);
  --ok-bg:rgba(46,125,91,.10);
  --warn:var(--dsw-alias-state-warn-primary,#A9661C);
  --warn-bg:rgba(169,102,28,.10);
  --risk:var(--dsw-alias-state-error-primary,#B23A3A);
  --risk-bg:rgba(178,58,58,.10);
}
.dsh-iw{background:var(--bg);color:var(--ink)}
.dsh-iw .iw-top,.dsh-iw .iw-rhead{background:var(--panel2);border-color:var(--line)}
.dsh-iw .iw-tabs,.dsh-iw .iw-proj,.dsh-iw .iw-seg{background:var(--panel);border-color:var(--line)}
.dsh-iw .iw-tabs button.on,.dsh-iw .iw-seg button.on{background:var(--panel2);color:var(--ink);box-shadow:inset 0 0 0 1px var(--line2)}
.dsh-iw .iw-proj{color:var(--muted)}
.dsh-iw .iw-brand b,.dsh-iw .iw-h2,.dsh-iw .iw-card-h b,.dsh-iw .iw-panel-h b,.dsh-iw .iw-empty b,
.dsh-iw .iw-table .name,.dsh-iw .iw-item .t b,.dsh-iw .iw-rhead .title,.dsh-iw .iw-cardlet h4,
.dsh-iw .iw-lib-row .tt,.dsh-iw .iw-lib-detail b,.dsh-iw .iw-rep b{color:var(--ink)}
.dsh-iw .iw-sub,.dsh-iw .iw-muted,.dsh-iw .iw-brand span{color:var(--muted)}
.dsh-iw .iw-pill{background:var(--panel2);border-color:var(--line);color:var(--muted)}
.dsh-iw .iw-pill.ai{background:var(--amber-bg);border-color:rgba(166,106,22,.28);color:var(--amber)}
.dsh-iw .iw-pill.ok{background:var(--ok-bg);border-color:rgba(46,125,91,.26);color:var(--ok)}
.dsh-iw .iw-pill.warn{background:var(--warn-bg);border-color:rgba(169,102,28,.28);color:var(--warn)}
.dsh-iw .iw-pill.risk{background:var(--risk-bg);border-color:rgba(178,58,58,.26);color:var(--risk)}
.dsh-iw .iw-pill.teal{background:var(--teal-bg);border-color:rgba(31,111,126,.24);color:var(--teal)}
.dsh-iw .iw-btn{background:var(--panel);border-color:var(--line2);color:var(--ink)}
.dsh-iw .iw-btn:hover{background:var(--panel2)}
.dsh-iw .iw-btn.ghost{background:var(--panel2);border-color:var(--line);color:var(--muted)}
.dsh-iw .iw-btn.primary{background:var(--teal);border-color:var(--teal);color:var(--panel);font-weight:600}
.dsh-iw .iw-hero{background:linear-gradient(140deg,var(--panel2),var(--panel));border-color:var(--line)}
.dsh-iw .iw-item{border-color:var(--line)}
.dsh-iw .iw-item:hover,.dsh-iw .iw-table tbody tr:hover td,.dsh-iw .iw-lib-row:hover{background:var(--panel2)}
.dsh-iw .iw-table th{background:var(--panel2);border-color:var(--line);color:var(--muted)}
.dsh-iw .iw-table td,.dsh-iw .iw-lib-row{border-color:var(--line);color:var(--ink)}
.dsh-iw .iw-lib-row:hover{background:var(--panel2)}
.dsh-iw .iw-input,.dsh-iw .iw-textarea,.dsh-iw .iw-select{background:var(--panel);border-color:var(--line2);color:var(--ink)}
.dsh-iw .iw-input:focus,.dsh-iw .iw-textarea:focus,.dsh-iw .iw-select:focus{border-color:var(--teal)}
.dsh-iw .iw-drop{background:var(--panel);border-color:var(--line2);color:var(--muted)}
.dsh-iw .iw-drop b{color:var(--ink)}
.dsh-iw .iw-bubble{background:var(--panel2);border-color:var(--line);color:var(--ink)}
.dsh-iw .iw-msg.user .iw-bubble{background:var(--teal-bg);border-color:rgba(31,111,126,.22)}
.dsh-iw .iw-compose{background:var(--panel);border-color:var(--line2)}
.dsh-iw .iw-compose textarea{color:var(--ink)}
.dsh-iw .iw-cardlet{background:var(--panel);border-color:var(--line)}
.dsh-iw .iw-cardlet p,.dsh-iw .iw-points{color:var(--muted)}
.dsh-iw .iw-cardlet .acts button{background:var(--panel2);border-color:var(--line);color:var(--muted)}
.dsh-iw .iw-cardlet .acts button:hover{border-color:var(--line2)}
.dsh-iw .iw-cardlet .acts button.ok{color:var(--ok);border-color:rgba(46,125,91,.28)}
.dsh-iw .iw-cardlet .acts button.no{color:var(--risk);border-color:rgba(178,58,58,.26)}
.dsh-iw .iw-gap{color:var(--warn);background:var(--warn-bg)}
.dsh-iw .iw-lib-detail{background:var(--panel2);color:var(--muted)}
.dsh-iw .iw-side,.dsh-iw .iw-editor{background:var(--panel)}
.dsh-iw .iw-rep.on{background:var(--panel2);border-color:var(--line2)}
.dsh-iw .iw-toast{background:var(--panel3);border-color:var(--line2);color:var(--ink)}
.dsh-iw .iw-error{background:var(--risk-bg);border-color:rgba(178,58,58,.3);color:var(--risk)}
.dsh-iw .iw-fatal{background:var(--risk-bg);border-color:rgba(178,58,58,.35);color:var(--risk)}
.dsh-iw .iw-fatal b{color:var(--risk)}
.dsh-iw .iw-fatal pre{background:var(--panel2);border-color:var(--line2);color:var(--risk)}
.dsh-iw .iw-pdfv,.dsh-iw .iw-pdfv-bar,.dsh-iw .iw-pdfv-send{background:var(--panel)}
.dsh-iw .iw-pdfv-bar,.dsh-iw .iw-pdfv-send{border-color:var(--line)}
.dsh-iw .iw-pdfv-send textarea{background:var(--panel2);border-color:var(--line2);color:var(--ink)}
.dsh-iw .iw-pdfv-note{background:var(--teal-bg);border-color:var(--line);color:var(--teal)}
.dsh-iw .iw-modal{background:var(--panel);border-color:var(--line2)}
.dsh-iw .iw-modal h3{color:var(--ink)}
.dsh-iw .iw-modal textarea{background:var(--panel2);border-color:var(--line2);color:var(--ink)}
.dsh-iw .iw-asset{border-color:var(--line)}
.dsh-iw .iw-asset .info b{color:var(--ink)}
.dsh-iw .iw-asset .info p{color:var(--muted)}
.dsh-iw .iw-rp,.dsh-iw .iw-rp-h,.dsh-iw .iw-rp-bar{background:var(--panel);border-color:var(--line)}
.dsh-iw .iw-rp-h b{color:var(--ink)}
.dsh-iw .iw-rp-bar textarea{background:var(--panel2);border-color:var(--line2);color:var(--ink)}
.dsh-iw .iw-skel{background:var(--panel2)}
.dsh-iw ::-webkit-scrollbar-thumb{background:var(--line2)}
.dsh-iw .iw-chartlib{flex:1;min-height:0;display:grid;grid-template-columns:250px minmax(0,1fr);gap:1px;background:var(--line)}
.dsh-iw .iw-folders{background:var(--panel);overflow:auto;padding:10px}
.dsh-iw .iw-folders .h{font-size:9.5px;color:var(--muted);letter-spacing:.05em;padding:4px 6px 8px}
.dsh-iw .iw-folders button{display:flex;align-items:center;gap:7px;width:100%;padding:7px 8px;border-radius:7px;
  text-align:left;color:var(--muted);font-size:10.5px;margin-bottom:2px}
.dsh-iw .iw-folders button:hover{background:var(--panel2)}
.dsh-iw .iw-folders button.on{background:var(--panel2);color:var(--ink);box-shadow:inset 0 0 0 1px var(--line2)}
.dsh-iw .iw-folders .t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-iw .iw-folders .n{font-size:9px;color:var(--dim)}
.dsh-iw .iw-chartmain{background:var(--bg);display:flex;flex-direction:column;min-height:0}
.dsh-iw .iw-chartmain .h{flex:none;height:44px;display:flex;align-items:center;gap:8px;padding:0 14px;border-bottom:1px solid var(--line)}
.dsh-iw .iw-chartmain .h b{font-size:12.5px;color:var(--ink)}
.dsh-iw .iw-chartmain .h span{font-size:9.5px;color:var(--muted)}
.dsh-iw .iw-chartgrid{flex:1;min-height:0;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;padding:14px}
.dsh-iw .iw-chartcard{background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden;display:flex;flex-direction:column;min-width:0}
.dsh-iw .iw-chartcard img{width:100%;height:150px;object-fit:contain;background:#fff;cursor:zoom-in;border-bottom:1px solid var(--line)}
.dsh-iw .iw-chartcard .info{padding:8px 10px;display:flex;flex-direction:column;gap:3px;min-width:0}
.dsh-iw .iw-chartcard b{font-size:10.5px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsh-iw .iw-chartcard span{font-size:8.8px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsh-iw .iw-chartcard .acts{display:flex;gap:8px;margin-top:4px}
.dsh-iw .iw-chartcard .acts button{font-size:9px;color:var(--teal);padding:0}
.dsh-iw .iw-chartcard .acts button.no{color:var(--risk)}
.dsh-iw .iw-chart-preview{max-height:62vh;overflow:auto;text-align:center;background:#fff;border-radius:7px;margin:8px 0}
.dsh-iw .iw-chart-preview img{max-width:100%;display:block;margin:0 auto}
.dsh-iw .iw-ev button{color:var(--teal);background:var(--teal-bg);border-color:rgba(31,111,126,.24)}
.dsh-iw .iw-quote{color:var(--gold);background:var(--warn-bg);border-left-color:var(--gold)}
.dsh-iw .iw-pdfv-send .q,.dsh-iw .iw-rp-bar .q{color:var(--muted)}
.dsh-iw .iw-compose .bar .hint,.dsh-iw .iw-pdfv-send .hint{color:var(--dim)}
.dsh-iw .iw-chat-h,.dsh-iw .iw-assets-h{color:var(--muted)}
.dsh-iw .iw-chartmain .h button{color:var(--muted)}


/* ===== Workbench visual system v2: layered paper, visible rules ===== */
.dsh-iw{
  --bg:#F1EEE3;
  --panel:#FBFAF5;
  --panel2:#E9E5D8;
  --panel3:#F4F2EA;
  --line:color-mix(in srgb,var(--dsw-alias-border-l1,#D9D5C8) 72%,var(--ink) 28%);
  --line2:color-mix(in srgb,var(--dsw-alias-border-l2,#CEC9BA) 55%,var(--ink) 45%);
  --paper:#FDFCF7; --paper2:#F0EDE3; --p-line:#D9D5C8;
  --teal:#C15F3C; --teal2:#A94E2F; --teal-bg:rgba(193,95,60,.10);
  --gold:#B07A2E; --amber:#B06A2C;
}
.dsh-iw .iw-mark{background:linear-gradient(140deg,#E7A183,#C15F3C);color:#FFF8F2;box-shadow:0 0 0 1px rgba(193,95,60,.22)}
.dsh-iw .iw-pill.teal{border-color:rgba(193,95,60,.24);color:var(--teal)}
.dsh-iw .iw-ev button{border-color:rgba(193,95,60,.22);color:var(--teal)}
.dsh-iw{background:var(--bg);color:var(--ink)}
.dsh-iw .iw-top{height:58px;background:var(--panel);border-bottom:1px solid var(--line);box-shadow:0 1px 2px rgba(31,42,46,.04)}
.dsh-iw .iw-tabs{padding:4px;background:var(--panel2);border:1px solid var(--line);border-radius:10px}
.dsh-iw .iw-tabs button{padding:6px 14px;color:var(--muted)}
.dsh-iw .iw-tabs button.on{background:var(--panel);color:var(--ink);box-shadow:0 1px 2px rgba(31,42,46,.08),inset 0 0 0 1px var(--line)}
.dsh-iw .iw-proj{background:var(--panel2);border-color:var(--line);color:var(--muted)}
.dsh-iw .iw-page{max-width:1320px;margin:0 auto;padding:22px 24px 32px}
.dsh-iw .iw-hero{background:linear-gradient(135deg,var(--panel),var(--panel2));border:1px solid var(--line);box-shadow:0 1px 2px rgba(31,42,46,.04)}
.dsh-iw .iw-stat{background:var(--panel);border:1px solid var(--line);box-shadow:0 1px 2px rgba(31,42,46,.04)}
.dsh-iw .iw-stat span{font-size:10.5px;color:var(--muted)}
.dsh-iw .iw-card{padding:14px 16px;border:1px solid var(--line);box-shadow:0 1px 2px rgba(31,42,46,.04)}
.dsh-iw .iw-card-h{padding-bottom:9px;margin-bottom:8px;border-bottom:1px solid var(--line)}
.dsh-iw .iw-card-h b:before,.dsh-iw .iw-panel-h b:before{content:"";display:inline-block;width:3px;height:12px;border-radius:2px;background:var(--teal);margin-right:7px;vertical-align:-1px}
.dsh-iw .iw-item{padding:10px 4px;border-color:var(--line)}
.dsh-iw .iw-item:hover{background:var(--panel2);border-radius:6px}
.dsh-iw .iw-table th{background:var(--panel2);border-color:var(--line);font-size:10px}
.dsh-iw .iw-table td{border-color:var(--line);font-size:11px}
.dsh-iw .iw-learn{gap:14px;padding:14px}
.dsh-iw .iw-panel{border:1px solid var(--line);box-shadow:0 1px 2px rgba(31,42,46,.04)}
.dsh-iw .iw-panel-h{height:44px;background:var(--panel2);border-bottom:1px solid var(--line)}
.dsh-iw .iw-btn{height:30px;padding:0 12px;font-size:11.5px;border-radius:7px;background:var(--panel);border-color:var(--line2);color:var(--ink)}
.dsh-iw .iw-btn.sm{height:25px;padding:0 9px;font-size:10.5px}
.dsh-iw .iw-btn.primary{background:var(--teal);border-color:var(--teal);box-shadow:0 1px 2px rgba(31,42,46,.14)}
.dsh-iw .iw-btn.ghost{background:var(--panel2);border-color:var(--line);color:var(--muted)}
.dsh-iw .iw-reader{background:var(--bg)}
.dsh-iw .iw-rhead{height:48px;background:var(--panel);border-bottom:1px solid var(--line)}
.dsh-iw .iw-rgrid{gap:10px;padding:10px;background:var(--bg)}
.dsh-iw .iw-pane{border:1px solid var(--line);border-radius:10px;box-shadow:0 1px 2px rgba(31,42,46,.04)}
.dsh-iw .iw-pane.assets{background:var(--panel2)}
.dsh-iw .iw-paper{background:var(--paper)}
.dsh-iw .iw-paper-h{background:var(--panel2);border-bottom:1px solid var(--p-line)}
.dsh-iw .iw-outline{background:var(--paper2);border-bottom:1px solid var(--p-line)}
.dsh-iw .iw-chat{background:var(--panel3)}
.dsh-iw .iw-chat-h{height:40px;background:var(--panel2);border-bottom:1px solid var(--line)}
.dsh-iw .iw-bubble{background:var(--panel);border-color:var(--line);box-shadow:0 1px 1px rgba(31,42,46,.03)}
.dsh-iw .iw-msg.user .iw-bubble{background:var(--teal-bg);border-color:rgba(31,111,126,.22)}
.dsh-iw .iw-compose{background:var(--panel);border-color:var(--line);box-shadow:0 1px 2px rgba(31,42,46,.04)}
.dsh-iw .iw-assets-h{height:40px;background:var(--panel2);border-bottom:1px solid var(--line)}
.dsh-iw .iw-assets-h button.on{background:var(--panel);color:var(--ink);box-shadow:0 1px 1px rgba(31,42,46,.05)}
.dsh-iw .iw-cardlet{background:var(--panel);border-color:var(--line);box-shadow:0 1px 2px rgba(31,42,46,.04)}
.dsh-iw .iw-write{gap:10px;padding:10px;background:var(--bg)}
.dsh-iw .iw-side,.dsh-iw .iw-editor{border:1px solid var(--line);border-radius:10px;overflow:hidden;box-shadow:0 1px 2px rgba(31,42,46,.04)}
.dsh-iw .iw-side-h,.dsh-iw .iw-ed-bar{background:var(--panel2);border-bottom:1px solid var(--line)}
.dsh-iw .iw-lib{padding:16px 18px}
.dsh-iw .iw-lib-body{flex:1;min-height:0;display:grid;grid-template-columns:252px minmax(0,1fr);gap:12px}
.dsh-iw .iw-lib-main{display:flex;flex-direction:column;min-height:0}
.dsh-iw .iw-lib-main .iw-filters{flex:none}
.dsh-iw .iw-lib-main .iw-lib-table{flex:1}
.dsh-iw .iw-lib-table{border:1px solid var(--line);box-shadow:0 1px 2px rgba(31,42,46,.04)}
.dsh-iw .iw-lib-row{padding:11px 14px;border-color:var(--line)}
.dsh-iw .iw-lib-row:hover{background:var(--panel2)}
.dsh-iw .iw-lib-detail{background:var(--panel2);border:1px solid var(--line)}
.dsh-iw .iw-chartlib{gap:12px;padding:14px;background:var(--bg)}
.dsh-iw .iw-folders{border:1px solid var(--line);border-radius:10px;box-shadow:0 1px 2px rgba(31,42,46,.04)}
.dsh-iw .iw-folders button.on{background:var(--panel2);box-shadow:inset 3px 0 0 var(--teal),inset 0 0 0 1px var(--line);color:var(--ink)}
.dsh-iw .iw-chartmain .h{height:48px;background:var(--panel);border:1px solid var(--line);border-radius:10px 10px 0 0}
.dsh-iw .iw-chartgrid{padding:12px 12px 0}
.dsh-iw .iw-chartcard{border:1px solid var(--line);box-shadow:0 1px 2px rgba(31,42,46,.05);border-radius:10px}
.dsh-iw .iw-toast{box-shadow:0 10px 30px rgba(31,42,46,.14)}
.dsh-iw .iw-figstrip{border-top:1px solid var(--p-line);background:var(--paper2)}
.dsh-iw .iw-block.heading{color:#8A3F2C}
.dsh-iw .iw-outline button:hover{color:var(--teal)}

.dsh-iw{--dim:color-mix(in srgb,var(--muted) 78%,var(--ink) 22%)}
.dsh-iw .iw-chat-h{font-size:11px;color:var(--muted)}
.dsh-iw .iw-msg .who{font-size:10px;color:var(--muted)}
.dsh-iw .iw-cardlet .board{font-size:9.5px;color:var(--muted)}
.dsh-iw .iw-cardlet .meta{font-size:10px}
.dsh-iw .iw-cardlet .acts button{font-size:9.5px;padding:3px 7px}
.dsh-iw .iw-assets-h button{font-size:10.5px;color:var(--muted)}
.dsh-iw .iw-lib-row .b,.dsh-iw .iw-lib-row .src{font-size:10px;color:var(--muted)}
.dsh-iw .iw-pdfv-bar .iw-dim,.dsh-iw .iw-chat-h .iw-dim{font-size:10px}

`
    const ICONS = {
      book: 'M4 5.5A2.5 2.5 0 016.5 3H19v16H6.5A2.5 2.5 0 004 21.5zM19 3v16',
      chat: 'M4 5h16v11H9l-5 4zM8 9h8M8 12h5',
      edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
      grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
      plus: 'M12 5v14M5 12h14',
      back: 'M15 5l-7 7 7 7',
      send: 'M4 12l16-8-6 8 6 8z',
      check: 'M4 12l5 5L20 6',
      x: 'M6 6l12 12M18 6L6 18',
      spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
      file: 'M7 3h7l5 5v13H7zM14 3v5h5',
      search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM16 16l4 4',
      trash: 'M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13',
      link: 'M10 14a4 4 0 010-6l3-3a4 4 0 016 6l-2 2M14 10a4 4 0 010 6l-3 3a4 4 0 01-6-6l2-2',
      arrow: 'M5 12h14M13 6l6 6-6 6',
      quote: 'M8 7H4v6h4v4H4M20 7h-4v6h4v4h-4',
    }
    function Icon(props) {
      const d = ICONS[props.name] || ICONS.book
      return h(
        'svg',
        {
          className: 'iw-icon',
          width: props.size || 15,
          height: props.size || 15,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
        },
        h('path', { d }),
      )
    }

    async function api(path, options) {
      const res = await fetch('/invest/api' + path, options)
      let data = null
      try {
        data = await res.json()
      } catch {
        data = null
      }
      if (!res.ok || (data && data.ok === false)) {
        const message = data && data.error && data.error.message ? data.error.message : 'HTTP ' + res.status
        throw new Error(message)
      }
      return data
    }

    function diag(kind, payload) {
      try {
        fetch('/invest/api/client-error', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(Object.assign({ kind, version: VERSION, at: new Date().toISOString() }, payload)),
        })
      } catch {
        /* diagnostics must never break the panel */
      }
    }

    function fmtDate(value) {
      if (!value) return ''
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return ''
      const pad = (n) => String(n).padStart(2, '0')
      return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate())
    }

    function statusPill(status) {
      if (status === 'confirmed' || status === 'edited') return h('span', { className: 'iw-pill ok' }, '已确认')
      if (status === 'rejected') return h('span', { className: 'iw-pill risk' }, '已驳回')
      return h('span', { className: 'iw-pill ai' }, 'AI 草稿')
    }

    function Toast(props) {
      if (!props.text) return null
      return h('div', { className: 'iw-toast' }, props.text)
    }

    function Empty(props) {
      return h('div', { className: 'iw-empty' }, h('b', null, props.title || '还没有内容'), props.text || '')
    }

    function Home(props) {
      const { overview, onImport, onNewReport, onDemo, onOpenSource, onOpenReport, busy } = props
      const counts = (overview && overview.counts) || {}
      const sources = (overview && overview.sources) || []
      const pending = (overview && overview.pendingCards) || []
      const reports = (overview && overview.reports) || []
      return h(
        'div',
        { className: 'iw-page iw-scroll' },
        h(
          'div',
          { className: 'iw-hero' },
          h(
            'div',
            null,
            h('h1', null, '研读台'),
            h(
              'p',
              null,
              '把一篇研报拆成可引用的段落与卡片，再把卡片装配成一份能被质问的行业报告。资料只进本地库，出网只发必要片段。',
            ),
          ),
          h(
            'div',
            { className: 'iw-actions' },
            h('button', { className: 'iw-btn primary', onClick: onImport }, h(Icon, { name: 'plus' }), '导入资料'),
            h('button', { className: 'iw-btn', onClick: onNewReport }, h(Icon, { name: 'edit' }), '新建报告'),
            h('button', { className: 'iw-btn ghost', onClick: onDemo, disabled: busy === 'demo' }, busy === 'demo' ? '写入中…' : '加载示例'),
          ),
        ),
        h(
          'div',
          { className: 'iw-stats' },
          h('div', { className: 'iw-stat' }, h('b', null, counts.sources || 0), h('span', null, '资料')),
          h('div', { className: 'iw-stat' }, h('b', null, counts.cards || 0), h('span', null, '沉淀卡')),
          h('div', { className: 'iw-stat' }, h('b', { style: { color: '#E8BE78' } }, counts.pending || 0), h('span', null, '待确认')),
          h('div', { className: 'iw-stat' }, h('b', null, counts.reports || 0), h('span', null, '报告')),
        ),
        h(
          'div',
          { className: 'iw-cols' },
          h(
            'div',
            { className: 'iw-card' },
            h('div', { className: 'iw-card-h' }, h('b', null, '最近资料'), h('span', { className: 'iw-grow' }), h('button', { className: 'iw-btn sm', onClick: onImport }, '＋ 新增')),
            sources.length
              ? h(
                  'div',
                  { className: 'iw-list' },
                  sources.map((source) =>
                    h(
                      'div',
                      { key: source.id, className: 'iw-item', onClick: () => onOpenSource(source.id) },
                      h('div', { className: 't' }, h('b', null, source.title), h('span', null, (source.org || '未标来源') + ' · ' + fmtDate(source.createdAt) + ' · ' + source.blocks.length + ' 段')),
                      h('span', { className: 'iw-pill' }, (source.cardCount || 0) + ' 卡'),
                    ),
                  ),
                )
              : h(Empty, { title: '还没有资料', text: '从「导入资料」上传 PDF/DOCX，或粘贴正文、给出链接。' }),
          ),
          h(
            'div',
            { className: 'iw-card' },
            h('div', { className: 'iw-card-h' }, h('b', null, '待确认卡片'), h('span', { className: 'iw-grow' }), h('span', { className: 'iw-pill ai' }, (counts.pending || 0) + ' 条')),
            pending.length
              ? h(
                  'div',
                  { className: 'iw-list' },
                  pending.map((card) =>
                    h(
                      'div',
                      { key: card.id, className: 'iw-item', onClick: () => onOpenSource(card.sourceId) },
                      h('div', { className: 't' }, h('b', null, card.title), h('span', null, card.board + ' · ' + (card.sourceTitle || ''))),
                      h('span', { className: 'iw-pill ai' }, '待确认'),
                    ),
                  ),
                )
              : h(Empty, { title: '没有待确认卡片', text: '在阅读台生成五板块分析后，AI 草稿会出现在这里。' }),
          ),
        ),
        reports.length
          ? h(
              'div',
              { className: 'iw-card', style: { marginTop: '12px' } },
              h('div', { className: 'iw-card-h' }, h('b', null, '报告')),
              h(
                'div',
                { className: 'iw-list' },
                reports.map((report) =>
                  h(
                    'div',
                    { key: report.id, className: 'iw-item', onClick: () => onOpenReport(report.id) },
                    h('div', { className: 't' }, h('b', null, report.title), h('span', null, (report.mode === 'quick' ? '快速模式' : '深度模式') + ' · ' + report.words + ' 字 · ' + report.status)),
                    h(Icon, { name: 'arrow' }),
                  ),
                ),
              ),
            )
          : null,
      )
    }

    function Learn(props) {
      const { sources, onOpen, onRefresh, onDelete, busy } = props
      const [tab, setTab] = useState('paste')
      const [title, setTitle] = useState('')
      const [org, setOrg] = useState('')
      const [text, setText] = useState('')
      const [url, setUrl] = useState('')
      const [localBusy, setLocalBusy] = useState('')
      const [error, setError] = useState('')
      const [fileName, setFileName] = useState('')
      const fileRef = useRef(null)

      async function submitPaste() {
        if (!text.trim()) return setError('先粘贴正文')
        setLocalBusy('paste')
        setError('')
        try {
          const data = await api('/sources', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ kind: 'paste', title, org, text }),
          })
          setText('')
          setTitle('')
          await onRefresh(data.source.id)
        } catch (err) {
          setError(err.message)
        } finally {
          setLocalBusy('')
        }
      }

      async function submitUrl() {
        if (!url.trim()) return setError('先填链接')
        setLocalBusy('url')
        setError('')
        try {
          const data = await api('/sources', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ kind: 'url', title, org, url }),
          })
          setUrl('')
          setTitle('')
          await onRefresh(data.source.id)
        } catch (err) {
          setError(err.message)
        } finally {
          setLocalBusy('')
        }
      }

      async function submitFile(file) {
        if (!file) return
        setLocalBusy('file')
        setError('')
        try {
          const buffer = await file.arrayBuffer()
          const query = '?name=' + encodeURIComponent(file.name) + '&title=' + encodeURIComponent(title) + '&org=' + encodeURIComponent(org)
          const data = await api('/sources/upload' + query, {
            method: 'POST',
            headers: { 'content-type': 'application/octet-stream' },
            body: buffer,
          })
          setFileName('')
          setTitle('')
          await onRefresh(data.source.id)
        } catch (err) {
          setError(err.message)
        } finally {
          setLocalBusy('')
        }
      }

      return h(
        'div',
        { className: 'iw-learn' },
        h(
          'div',
          { className: 'iw-panel' },
          h(
            'div',
            { className: 'iw-panel-h' },
            h('b', null, '资料台账'),
            h('span', { className: 'iw-pill' }, sources.length + ' 份'),
            h('span', { className: 'iw-grow' }),
            h('button', { className: 'iw-btn sm', onClick: () => onRefresh() }, '刷新'),
          ),
          sources.length
            ? h(
                'div',
                { className: 'iw-scroll', style: { flex: 1 } },
                h(
                  'table',
                  { className: 'iw-table' },
                  h('thead', null, h('tr', null, h('th', null, '资料'), h('th', null, '来源'), h('th', null, '段落'), h('th', null, '卡片'), h('th', null, ''))),
                  h(
                    'tbody',
                    null,
                    sources.map((source) =>
                      h(
                        'tr',
                        { key: source.id, onClick: () => onOpen(source.id) },
                        h('td', null, h('span', { className: 'name' }, source.title), h('span', { className: 'sub' }, fmtDate(source.createdAt) + ' · ' + (source.kind === 'file' ? '文件' : source.kind === 'url' ? '网页' : '粘贴'))),
                        h('td', null, source.org || '—'),
                        h('td', null, source.blocks.length),
                        h('td', null, source.cardCount || 0),
                        h(
                          'td',
                          null,
                          h(
                            'button',
                            {
                              className: 'iw-btn sm ghost',
                              title: '删除',
                              onClick: (event) => {
                                event.stopPropagation()
                                if (window.confirm('删除这份资料及其卡片？')) onDelete(source.id)
                              },
                            },
                            h(Icon, { name: 'trash', size: 12 }),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              )
            : h(Empty, { title: '资料台账是空的', text: '右侧上传文件、粘贴正文或给一个网页链接。' }),
        ),
        h(
          'div',
          { className: 'iw-panel' },
          h('div', { className: 'iw-panel-h' }, h('b', null, '新建拆解')),
          h(
            'div',
            { className: 'iw-import' },
            h(
              'div',
              { className: 'iw-seg' },
              ['paste', 'file', 'url'].map((key) =>
                h('button', { key, className: tab === key ? 'on' : '', onClick: () => { setTab(key); setError('') } }, key === 'paste' ? '粘贴正文' : key === 'file' ? '上传文件' : '网页链接'),
              ),
            ),
            error ? h('div', { className: 'iw-error' }, h(Icon, { name: 'x', size: 12 }), h('span', null, error)) : null,
            h('div', { className: 'iw-field' }, h('label', null, '标题（可留空）'), h('input', { className: 'iw-input', value: title, onChange: (e) => setTitle(e.target.value), placeholder: '例：冷板式液冷：2027 年的渗透拐点' })),
            h('div', { className: 'iw-field' }, h('label', null, '来源机构（可留空）'), h('input', { className: 'iw-input', value: org, onChange: (e) => setOrg(e.target.value), placeholder: '例：某券商研究所' })),
            tab === 'paste'
              ? h(
                  'div',
                  null,
                  h('div', { className: 'iw-field' }, h('label', null, '正文'), h('textarea', { className: 'iw-textarea', rows: 9, value: text, onChange: (e) => setText(e.target.value), placeholder: '粘贴研报正文或调研纪要，至少 100 字…' })),
                  h('button', { className: 'iw-btn primary', style: { width: '100%', justifyContent: 'center' }, onClick: submitPaste, disabled: localBusy === 'paste' }, localBusy === 'paste' ? '解析中…' : '开始解析'),
                )
              : null,
            tab === 'file'
              ? h(
                  'div',
                  null,
                  h(
                    'div',
                    { className: 'iw-drop', onClick: () => fileRef.current && fileRef.current.click() },
                    h('b', null, fileName || '选择 PDF / DOCX / TXT / MD'),
                    '单文件 ≤ 24MB · PDF 需要可抽取文本',
                  ),
                  h('input', { ref: fileRef, type: 'file', accept: '.pdf,.docx,.txt,.md', style: { display: 'none' }, onChange: (e) => { const file = e.target.files && e.target.files[0]; if (file) { setFileName(file.name); submitFile(file) } } }),
                  localBusy === 'file' ? h('div', { className: 'iw-busy', style: { marginTop: '8px' } }, '正在解析文件…') : null,
                )
              : null,
            tab === 'url'
              ? h(
                  'div',
                  null,
                  h('div', { className: 'iw-field' }, h('label', null, '网页链接'), h('input', { className: 'iw-input', value: url, onChange: (e) => setUrl(e.target.value), placeholder: 'https://…（含公众号文章）' })),
                  h('button', { className: 'iw-btn primary', style: { width: '100%', justifyContent: 'center' }, onClick: submitUrl, disabled: localBusy === 'url' }, localBusy === 'url' ? '抓取中…' : '抓取并解析'),
                  h('p', { className: 'iw-dim', style: { fontSize: '9.5px', marginTop: '7px', lineHeight: 1.7 } }, 'V1 只抓用户给定的 URL，不做站内检索；遇反爬或登录墙请切「粘贴正文」。'),
                )
              : null,
          ),
        ),
      )
    }

    function PdfPageView(props) {
      const { source, onAsk } = props
      const [page, setPage] = useState(1)
      const [layout, setLayout] = useState(null)
      const [scale, setScale] = useState(0)
      const [status, setStatus] = useState('loading')
      const [quote, setQuote] = useState('')
      const [question, setQuestion] = useState('')
      const [busy, setBusy] = useState(false)
      const [note, setNote] = useState('')
      const [err, setErr] = useState('')
      const boxRef = useRef(null)
      const imgRef = useRef(null)
      const pageCount = source.pageCount || (layout && layout.pageCount) || 1

      useEffect(() => {
        let cancelled = false
        setStatus('loading')
        setErr('')
        api('/sources/' + source.id + '/page/' + page + '/text')
          .then((data) => {
            if (cancelled) return
            setLayout(data)
            setStatus(data.items && data.items.length ? 'ready' : 'empty')
          })
          .catch((error) => {
            if (cancelled) return
            setErr(error.message)
            setStatus('error')
          })
        return () => {
          cancelled = true
        }
      }, [source.id, page])

      useEffect(() => {
        const update = () => {
          if (imgRef.current && layout && layout.width) {
            setScale(imgRef.current.clientWidth / layout.width)
          }
        }
        update()
        if (typeof window !== 'undefined') window.addEventListener('resize', update)
        return () => {
          if (typeof window !== 'undefined') window.removeEventListener('resize', update)
        }
      }, [layout, status])

      function onUp() {
        const selection = typeof window !== 'undefined' ? window.getSelection() : null
        const text = selection ? selection.toString().replace(/\s+/g, ' ').trim() : ''
        if (!text) return
        if (boxRef.current && selection.anchorNode && !boxRef.current.contains(selection.anchorNode)) return
        setQuote(text.slice(0, 1500))
        setNote('')
      }

      async function send() {
        if (!quote || busy) return
        setBusy(true)
        setErr('')
        try {
          await onAsk({
            quote,
            page,
            question: question.trim() || '请结合这段解释，并给出处。',
          })
          setNote('已回答在中间对话')
          setQuote('')
          setQuestion('')
        } catch (error) {
          setErr(error.message)
        } finally {
          setBusy(false)
        }
      }

      function go(next) {
        setPage(Math.max(1, Math.min(Number(next) || 1, pageCount)))
        setQuote('')
        setQuestion('')
        setNote('')
      }

      return h(
        'div',
        { className: 'iw-pdfv' },
        h(
          'div',
          { className: 'iw-pdfv-bar' },
          h('button', { className: 'iw-btn sm ghost', onClick: () => go(page - 1), disabled: page <= 1 }, '上一页'),
          h('input', {
            className: 'iw-input',
            type: 'number',
            min: 1,
            max: pageCount,
            value: page,
            style: { width: '54px', height: '24px', textAlign: 'center' },
            onChange: (event) => go(event.target.value),
          }),
          h('span', { className: 'iw-dim', style: { fontSize: '10px' } }, '/ ' + pageCount),
          h('button', { className: 'iw-btn sm ghost', onClick: () => go(page + 1), disabled: page >= pageCount }, '下一页'),
          h('span', { className: 'iw-grow' }),
          h('span', { className: 'iw-dim', style: { fontSize: '9.5px' } }, '拖选文字 → 在中间对话里回答'),
          h('a', { href: '/invest/api/sources/' + source.id + '/file', target: '_blank', rel: 'noreferrer', className: 'iw-btn sm ghost', style: { textDecoration: 'none' } }, '原文'),
        ),
        err ? h('div', { className: 'iw-error', style: { margin: '6px 8px 0' } }, h(Icon, { name: 'x', size: 12 }), h('span', null, err)) : null,
        h(
          'div',
          { className: 'iw-pdfv-scroll' },
          h(
            'div',
            { className: 'iw-pdfv-page', ref: boxRef, onMouseUp: onUp },
            h('img', {
              ref: imgRef,
              src: '/invest/api/sources/' + source.id + '/page/' + page,
              alt: 'PDF 第 ' + page + ' 页',
              draggable: false,
              onLoad: () => {
                if (imgRef.current && layout && layout.width) setScale(imgRef.current.clientWidth / layout.width)
              },
            }),
            layout && scale
              ? h(
                  'div',
                  { className: 'iw-pdfv-text' },
                  layout.items.map((item, index) =>
                    h(
                      'span',
                      {
                        key: index,
                        style: {
                          left: item.l * scale + 'px',
                          top: item.t * scale + 'px',
                          width: Math.max(item.w * scale, 1) + 'px',
                          height: Math.max(item.h * scale, 1) + 'px',
                          fontSize: Math.max(item.h * scale, 1) + 'px',
                        },
                      },
                      item.str,
                    ),
                  ),
                )
              : null,
          ),
          status === 'empty'
            ? h('div', { className: 'iw-pdfv-empty' }, '这一页没有文字层（扫描件或纯图）。图表可回到文本模式用「截取图表」存入知识库。')
            : null,
        ),
        quote
          ? h(
              'div',
              { className: 'iw-pdfv-send' },
              h('div', { className: 'q' }, '“' + (quote.length > 120 ? quote.slice(0, 120) + '…' : quote) + '”', h('span', null, ' p.' + page)),
              h('textarea', {
                value: question,
                placeholder: '问什么？可留空，默认请它结合这段解释并给出处。',
                onChange: (event) => setQuestion(event.target.value),
                onKeyDown: (event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    send()
                  }
                },
              }),
              h(
                'div',
                { className: 'row' },
                h('span', { className: 'hint' }, 'Enter 发送 · Shift+Enter 换行'),
                h('span', { className: 'iw-grow' }),
                h('button', { className: 'iw-btn sm ghost', onClick: () => { setQuote(''); setQuestion('') } }, '取消'),
                h('button', { className: 'iw-btn sm primary', onClick: send, disabled: busy }, busy ? '发送中…' : '丢回对话'),
              ),
            )
          : null,
        note ? h('div', { className: 'iw-pdfv-note' }, note) : null,
      )
    }

    function Reader(props) {
      const { source, onBack, onSource, notify } = props
      const [selected, setSelected] = useState('')
      const [question, setQuestion] = useState('')
      const [asking, setAsking] = useState(false)
      const [analyzing, setAnalyzing] = useState('')
      const [filter, setFilter] = useState('all')
      const [pageMode, setPageMode] = useState('page')
      const [captureOpen, setCaptureOpen] = useState(false)
      const [reparsing, setReparsing] = useState(false)
      const [assets, setAssets] = useState([])
      const [extracting, setExtracting] = useState(false)
      const [reviseTarget, setReviseTarget] = useState(null)
      const [reviseReason, setReviseReason] = useState('')
      const [revising, setRevising] = useState(false)
      const [err, setErr] = useState('')
      const blockRefs = useRef({})
      const msgsRef = useRef(null)

      const cards = source.cards || []
      const qa = source.qa || []
      const headings = (source.blocks || []).filter((block) => block.heading)

      useEffect(() => {
        setSelected('')
        setQuestion('')
        setFilter('all')
        setErr('')
      }, [source.id])

      useEffect(() => {
        if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight
      }, [qa.length, asking])

      useEffect(() => {
        let cancelled = false
        api('/assets?source_id=' + encodeURIComponent(source.id))
          .then((data) => {
            if (!cancelled) setAssets(data.assets || [])
          })
          .catch(() => {})
        return () => {
          cancelled = true
        }
      }, [source.id])

      function scrollTo(blockId) {
        setSelected(blockId)
        const el = blockRefs.current[blockId]
        if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }

      async function ask() {
        const text = question.trim()
        if (!text || asking) return
        setAsking(true)
        setErr('')
        try {
          const data = await api('/sources/' + encodeURIComponent(source.id) + '/ask', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ question: text, blockId: selected }),
          })
          onSource({ ...source, qa: [...qa, data.qa] })
          setQuestion('')
        } catch (error) {
          setErr(error.message)
        } finally {
          setAsking(false)
        }
      }

      async function askFromPdf(payload) {
        setAsking(true)
        setErr('')
        try {
          const data = await api('/sources/' + encodeURIComponent(source.id) + '/ask', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              question: payload.question || '请结合这段解释，并给出处。',
              quote: payload.quote,
              page: payload.page,
            }),
          })
          onSource({ ...source, qa: [...qa, data.qa] })
          if (data.warning) setErr(data.warning)
        } catch (error) {
          setErr(error.message)
        } finally {
          setAsking(false)
        }
      }

      async function reparse() {
        setReparsing(true)
        setErr('')
        try {
          const data = await api('/sources/' + encodeURIComponent(source.id) + '/reparse', { method: 'POST' })
          onSource(data.source)
          const list = await api('/assets?source_id=' + encodeURIComponent(source.id))
          setAssets(list.assets || [])
          notify('已重新解析' + (data.figures ? '，提取 ' + data.figures + ' 张图表' : '') + (data.warning ? '；' + data.warning : ''))
        } catch (error) {
          setErr(error.message)
        } finally {
          setReparsing(false)
        }
      }

      async function extractFigures() {
        setExtracting(true)
        setErr('')
        try {
          const data = await api('/sources/' + encodeURIComponent(source.id) + '/figures/extract', { method: 'POST' })
          const list = await api('/assets?source_id=' + encodeURIComponent(source.id))
          setAssets(list.assets || [])
          notify(data.added ? '已提取 ' + data.added + ' 张图表，存进图表知识库' : '没有发现新的图表')
        } catch (error) {
          setErr(error.message)
        } finally {
          setExtracting(false)
        }
      }

      async function analyze(engine) {
        setAnalyzing(engine)
        setErr('')
        try {
          const data = await api('/sources/' + encodeURIComponent(source.id) + '/analyze', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ engine }),
          })
          onSource({ ...source, cards: data.cards })
          if (data.engine === 'ai') notify('AI 已生成 ' + data.added + ' 张卡片，逐张确认后入库')
          else notify(data.warning || '已用本地规则抽取 ' + data.added + ' 张卡片')
        } catch (error) {
          setErr(error.message)
        } finally {
          setAnalyzing('')
        }
      }

      async function setCardStatus(card, status) {
        try {
          const data = await api('/cards/' + encodeURIComponent(card.id), {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ status }),
          })
          onSource({ ...source, cards: cards.map((item) => (item.id === card.id ? data.card : item)) })
          notify(status === 'confirmed' ? '已确认入库' : '已驳回')
        } catch (error) {
          setErr(error.message)
        }
      }

      async function reviseCard(card, reason) {
        setErr('')
        try {
          const data = await api('/cards/' + encodeURIComponent(card.id) + '/revise', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ reason: reason || '' }),
          })
          onSource({ ...source, cards: cards.map((item) => (item.id === card.id ? data.card : item)) })
          notify('AI 已按驳回原因重写，请重新确认')
        } catch (error) {
          setErr('AI 重写失败：' + error.message)
        }
      }

      function rejectCard(card) {
        setReviseTarget({ card, mode: 'reject' })
        setReviseReason('')
      }

      function rewriteCard(card) {
        setReviseTarget({ card, mode: 'rewrite' })
        setReviseReason('')
      }

      async function submitRevise(onlyReject) {
        const target = reviseTarget
        if (!target) return
        setReviseTarget(null)
        if (onlyReject) {
          setCardStatus(target.card, 'rejected')
          return
        }
        setRevising(true)
        try {
          await reviseCard(target.card, reviseReason.trim())
        } finally {
          setRevising(false)
        }
      }

      function renderReviseModal() {
        const target = reviseTarget
        if (!target) return null
        const rejectMode = target.mode === 'reject'
        return h(
          'div',
          { className: 'iw-modal-mask', onClick: (event) => { if (event.target === event.currentTarget) setReviseTarget(null) } },
          h(
            'div',
            { className: 'iw-modal' },
            h('h3', null, rejectMode ? '驳回并让 AI 重写' : '让 AI 重写这张卡'),
            h('p', null, rejectMode ? '驳回原因会一起交给模型；留空则只驳回、不重写。' : '写下希望修正的方向；留空则按原文重新总结。'),
            h('textarea', {
              value: reviseReason,
              autoFocus: true,
              placeholder: rejectMode ? '例：口径不对，8–12 万不含 CDU；标题写成含 CDU 了' : '例：补一条具体数字，并说明口径',
              onChange: (event) => setReviseReason(event.target.value),
            }),
            h(
              'div',
              { className: 'row' },
              h('button', { className: 'iw-btn ghost', onClick: () => setReviseTarget(null) }, '取消'),
              rejectMode ? h('button', { className: 'iw-btn ghost', onClick: () => submitRevise(true) }, '仅驳回') : null,
              h('button', { className: 'iw-btn primary', onClick: () => submitRevise(false), disabled: revising }, revising ? '重写中…' : '提交给 AI'),
            ),
          ),
        )
      }

      const shown = cards.filter((card) => {
        if (filter === 'pending') return card.status === 'ai_draft'
        if (filter === 'confirmed') return card.status === 'confirmed' || card.status === 'edited'
        return true
      })

      return h(
        'div',
        { className: 'iw-reader' },
        h(
          'div',
          { className: 'iw-rhead' },
          h('button', { className: 'iw-btn sm ghost', onClick: onBack }, h(Icon, { name: 'back', size: 13 }), '返回'),
          h('span', { className: 'title' }, source.title),
          source.org ? h('span', { className: 'iw-pill' }, source.org) : null,
          h('span', { className: 'iw-pill' }, (source.blocks || []).length + ' 段'),
          h('span', { className: 'iw-grow' }),
          h(
            'button',
            { className: 'iw-btn primary', onClick: () => analyze('ai'), disabled: Boolean(analyzing) },
            h(Icon, { name: 'spark', size: 13 }),
            analyzing === 'ai' ? 'AI 分析中…' : 'AI 摘要',
          ),
          h(
            'button',
            { className: 'iw-btn ghost', onClick: () => analyze('rule'), disabled: Boolean(analyzing), title: '不调用模型，用关键词与段落规则抽取' },
            analyzing === 'rule' ? '抽取中…' : '本地抽取',
          ),
          source.hasFile
            ? h('button', { className: 'iw-btn ghost', onClick: () => setCaptureOpen(true) }, h(Icon, { name: 'grid', size: 13 }), '截取图表')
            : null,
          source.hasFile
            ? h('button', { className: 'iw-btn ghost', onClick: reparse, disabled: reparsing }, h(Icon, { name: 'spark', size: 13 }), reparsing ? '解析中…' : '重新解析')
            : null,
          source.hasFile
            ? h('button', { className: 'iw-btn ghost', onClick: extractFigures, disabled: extracting }, h(Icon, { name: 'grid', size: 13 }), extracting ? '提取中…' : '提取图表')
            : null,
        ),
        err ? h('div', { className: 'iw-error', style: { margin: '6px 12px 0' } }, h(Icon, { name: 'x', size: 12 }), h('span', null, err)) : null,
        h(
          'div',
          { className: 'iw-rgrid' },
          h(
            'div',
            { className: 'iw-pane' },
            h(
              'div',
              { className: 'iw-paper' },
              h(
                'div',
                { className: 'iw-paper-h' },
                h('h2', null, source.title),
                h('div', { className: 'meta' }, h('span', null, source.kind === 'file' ? '文件' : source.kind === 'url' ? '网页' : '粘贴'), source.pageCount ? h('span', null, '· ' + source.pageCount + ' 页') : null, h('span', null, '· ' + fmtDate(source.createdAt))),
                source.hasFile
                  ? h(
                      'div',
                      { style: { display: 'flex', gap: '4px', marginTop: '7px', alignItems: 'center' } },
                      h('button', { className: pageMode === 'text' ? 'iw-btn sm primary' : 'iw-btn sm ghost', onClick: () => setPageMode('text') }, '文本'),
                      h('button', { className: pageMode === 'page' ? 'iw-btn sm primary' : 'iw-btn sm ghost', onClick: () => setPageMode('page') }, 'PDF 圈选'),
                      h('a', { href: '/invest/api/sources/' + source.id + '/file', target: '_blank', rel: 'noreferrer', className: 'iw-btn sm ghost', style: { textDecoration: 'none' } }, '新窗口'),
                    )
                  : null,
              ),
              pageMode === 'page' && source.hasFile
                ? h(PdfPageView, { source, onAsk: askFromPdf })
                : h(
                    'div',
                    { style: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } },
                    headings.length
                      ? h(
                          'div',
                          { className: 'iw-outline' },
                          headings.map((block) =>
                            h('button', { key: block.id, onClick: () => scrollTo(block.id), title: block.text }, block.text),
                          ),
                        )
                      : null,
                    h(
                      'div',
                      { className: 'iw-doc' },
                      (source.blocks || []).map((block) =>
                        h(
                          'p',
                          {
                            key: block.id,
                            ref: (el) => {
                              blockRefs.current[block.id] = el
                            },
                            className: 'iw-block' + (block.heading ? ' heading' : '') + (selected === block.id ? ' sel' : ''),
                            onClick: () => setSelected(block.id === selected ? '' : block.id),
                            title: '点击选中，随后提问会带上这一段',
                          },
                          block.text,
                        ),
                      ),
                    ),
                    assets.filter((asset) => asset.kind === 'figure').length
                      ? h(
                          'div',
                          { className: 'iw-figstrip' },
                          h('div', { className: 'h' }, '自动提取的图表 ' + assets.filter((asset) => asset.kind === 'figure').length + ' 张 · 已存入图表知识库'),
                          h(
                            'div',
                            { className: 'row' },
                            assets
                              .filter((asset) => asset.kind === 'figure')
                              .map((asset) =>
                                h(
                                  'a',
                                  { key: asset.id, href: assetImageUrl(asset), target: '_blank', rel: 'noreferrer', title: asset.caption || asset.title },
                                  h('img', { src: assetImageUrl(asset), alt: asset.title }),
                                  h('span', null, asset.title),
                                ),
                              ),
                          ),
                        )
                      : null,
                  ),
            ),
          ),
          h(
            'div',
            { className: 'iw-pane' },
            h(
              'div',
              { className: 'iw-chat' },
              h('div', { className: 'iw-chat-h' }, h(Icon, { name: 'chat', size: 13 }), '研读问答', h('span', { className: 'iw-grow' }), h('span', { className: 'iw-dim' }, '选中 PDF 原文提问 · 调模型但只依据资料')),
              h(
                'div',
                { className: 'iw-msgs', ref: msgsRef },
                qa.length === 0
                  ? h(Empty, { title: '在中间对话里问', text: '在左侧 PDF 上拖选一段，或在下方输入问题；回答只依据资料，并带段落引用。' })
                  : qa.map((item) =>
                      h(
                        'div',
                        { key: item.id },
                        h('div', { className: 'iw-msg user' }, h('div', { className: 'who' }, '你'), h('div', { className: 'iw-bubble' }, item.question)),
                        h(
                          'div',
                          { className: 'iw-msg' },
                          h('div', { className: 'who' }, h(Icon, { name: 'spark', size: 12 }), '研读助手'),
                          h(
                            'div',
                            { className: 'iw-bubble' },
                            item.answer,
                            item.evidence && item.evidence.length
                              ? h(
                                  'div',
                                  { className: 'iw-ev' },
                                  item.evidence.map((evidence) =>
                                    h('button', { key: evidence.blockId, onClick: () => scrollTo(evidence.blockId), title: evidence.quote }, '证据 · ' + evidence.blockId),
                                  ),
                                )
                              : null,
                          ),
                        ),
                      ),
                    ),
                asking ? h('div', { className: 'iw-msg' }, h('div', { className: 'iw-who' }), h('div', { className: 'iw-bubble' }, h('div', { className: 'iw-skel', style: { width: '72%' } }), h('div', { className: 'iw-skel', style: { width: '54%' } }))) : null,
              ),
              h(
                'div',
                { className: 'iw-compose' },
                selected ? h('div', { className: 'ctx' }, h('span', { className: 'iw-pill teal' }, '已选中 ' + selected), h('button', { className: 'iw-btn sm ghost', onClick: () => setSelected('') }, '取消')) : null,
                h('textarea', {
                  value: question,
                  placeholder: '针对这段问：口径是什么？和另一段冲突吗？',
                  onChange: (e) => setQuestion(e.target.value),
                  onKeyDown: (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      ask()
                    }
                  },
                }),
                h(
                  'div',
                  { className: 'bar' },
                  h('span', { className: 'hint' }, 'Enter 发送 · Shift+Enter 换行'),
                  h('span', { className: 'iw-grow' }),
                  h('button', { className: 'iw-btn primary sm', onClick: ask, disabled: asking || !question.trim() }, h(Icon, { name: 'send', size: 12 }), asking ? '检索中' : '发送'),
                ),
              ),
            ),
          ),
          h(
            'div',
            { className: 'iw-pane assets' },
            h(
              'div',
              { className: 'iw-assets' },
              h(
                'div',
                { className: 'iw-assets-h' },
                ['all', 'pending', 'confirmed'].map((key) =>
                  h('button', { key, className: filter === key ? 'on' : '', onClick: () => setFilter(key) }, key === 'all' ? '全部 ' + cards.length : key === 'pending' ? '待确认' : '已确认'),
                ),
                h('span', { className: 'iw-grow' }),
                h('span', { className: 'iw-dim', style: { fontSize: '9px' } }, 'AI 草稿'),
              ),
              h(
                'div',
                { className: 'iw-cards' },
                shown.length
                  ? shown.map((card) =>
                      h(
                        'div',
                        { key: card.id, className: 'iw-cardlet' },
                        h('div', { className: 'top' }, h('span', { className: 'board' }, card.board), h('span', { className: 'iw-grow' }), statusPill(card.status)),
                        h('h4', null, card.title),
                        h('p', null, card.thesis),
                        card.points && card.points.length
                          ? h('ul', { className: 'iw-points' }, card.points.map((point, index) => h('li', { key: index }, point)))
                          : null,
                        card.gaps && card.gaps.length ? h('div', { className: 'iw-gap' }, '待补：' + card.gaps.join('；')) : null,
                        h(
                          'div',
                          { className: 'meta' },
                          h('span', null, (card.evidence || []).length + ' 条证据'),
                          card.evidence && card.evidence[0]
                            ? h('button', { style: { color: '#8FDCE7', fontSize: '9px' }, onClick: () => scrollTo(card.evidence[0].blockId) }, '看原文')
                            : null,
                        ),
                        card.status === 'ai_draft'
                          ? h(
                              'div',
                              { className: 'acts' },
                              h('button', { className: 'ok', onClick: () => setCardStatus(card, 'confirmed') }, h(Icon, { name: 'check', size: 10 }), '确认'),
                              h('button', { onClick: () => rewriteCard(card) }, h(Icon, { name: 'spark', size: 10 }), 'AI 重写'),
                              h('button', { className: 'no', onClick: () => rejectCard(card) }, h(Icon, { name: 'x', size: 10 }), '驳回'),
                            )
                          : null,
                      ),
                    )
                  : h(Empty, { title: '还没有卡片', text: '点上方「AI 摘要」让模型按五板块总结；也可用「本地抽取」离线跑规则。' }),
              ),
            ),
          ),
        ),
        renderReviseModal(),
        captureOpen ? h(FigureCapture, { source, onClose: () => setCaptureOpen(false), notify }) : null,
      )
    }

    function Writer(props) {
      const { report, reports, cards, onOpenReport, onCreate, onReport, onGoLibrary, notify } = props
      const [title, setTitle] = useState(report ? report.title : '')
      const [content, setContent] = useState(report ? report.content : '')
      const [status, setStatus] = useState(report ? report.status : 'draft')
      const [citations, setCitations] = useState([])
      const [dirty, setDirty] = useState(false)
      const [saving, setSaving] = useState(false)
      const [tab, setTab] = useState('cards')
      const [assets, setAssets] = useState([])
      const [err, setErr] = useState('')
      const textRef = useRef(null)

      useEffect(() => {
        if (tab !== 'assets') return
        api('/assets')
          .then((data) => setAssets(data.assets || []))
          .catch((error) => setErr(error.message))
      }, [tab])

      useEffect(() => {
        setTitle(report ? report.title : '')
        setContent(report ? report.content : '')
        setStatus(report ? report.status : 'draft')
        setCitations(report ? report.citations || [] : [])
        setDirty(false)
        setErr('')
      }, [report && report.id])

      const confirmed = (cards || []).filter((card) => card.status === 'confirmed' || card.status === 'edited')

      async function save() {
        if (!report || saving) return
        setSaving(true)
        setErr('')
        try {
          const data = await api('/reports/' + encodeURIComponent(report.id), {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ title, content, status, citations }),
          })
          onReport(data.report)
          setDirty(false)
          notify('已保存')
        } catch (error) {
          setErr(error.message)
        } finally {
          setSaving(false)
        }
      }

      function insert(snippet) {
        const textarea = textRef.current
        const start = textarea ? textarea.selectionStart : content.length
        const next = content.slice(0, start) + snippet + content.slice(start)
        setContent(next)
        setDirty(true)
        window.setTimeout(() => {
          if (textarea) {
            textarea.focus()
            textarea.selectionStart = textarea.selectionEnd = start + snippet.length
          }
        }, 0)
      }

      function cite(card) {
        insert('\n\n> ' + card.thesis + '（来源：' + (card.sourceTitle || '资料') + '）\n')
        setCitations((prev) => [...prev, { cardId: card.id, title: card.title, sourceTitle: card.sourceTitle || '', quote: card.thesis }])
      }

      function insertAsset(asset) {
        if (asset.kind === 'figure') {
          insert('\n\n![' + (asset.caption || asset.title) + '](' + assetAbsoluteImageUrl(asset) + ')\n*来源：' + (asset.sourceNote || '资料') + '*\n')
        } else {
          insert('\n\n' + assetMarkdown(asset) + '\n')
        }
        notify('已插入正文')
      }

      if (!report) {
        return h(
          'div',
          { className: 'iw-ed-empty' },
          h(
            'div',
            null,
            h('b', { style: { display: 'block', fontSize: '14px', color: '#2A383E', marginBottom: '6px' } }, '还没有打开的报告'),
            h('p', { style: { fontSize: '11px', margin: '0 0 10px' } }, '新建一份，或从左侧选一份继续写。'),
            h('button', { className: 'iw-btn primary', onClick: onCreate }, h(Icon, { name: 'plus' }), '新建报告'),
          ),
        )
      }

      return h(
        'div',
        { className: 'iw-write' },
        h(
          'div',
          { className: 'iw-side' },
          h('div', { className: 'iw-side-h' }, h('b', { style: { color: '#DCEAEE', fontSize: '11px' } }, '报告'), h('span', { className: 'iw-grow' }), h('button', { className: 'iw-btn sm ghost', onClick: onCreate }, '＋')),
          h(
            'div',
            { className: 'iw-rep-list' },
            (reports || []).map((item) =>
              h(
                'button',
                { key: item.id, className: 'iw-rep' + (item.id === report.id ? ' on' : ''), onClick: () => onOpenReport(item.id) },
                h('b', null, item.title),
                h('span', null, (item.mode === 'quick' ? '快速' : '深度') + ' · ' + item.words + ' 字 · ' + item.status),
              ),
            ),
          ),
        ),
        h(
          'div',
          { className: 'iw-editor' },
          h(
            'div',
            { className: 'iw-ed-bar' },
            h('button', { className: 'iw-btn sm primary', onClick: save, disabled: saving || !dirty }, saving ? '保存中…' : dirty ? '保存' : '已保存'),
            h('select', { className: 'iw-select', style: { width: '96px', height: '24px', padding: '0 6px', fontSize: '10px' }, value: status, onChange: (e) => { setStatus(e.target.value); setDirty(true) } },
              h('option', { value: 'draft' }, '草稿'),
              h('option', { value: 'reviewing' }, '审阅中'),
              h('option', { value: 'final' }, '定稿'),
            ),
            h('span', { className: 'iw-grow' }),
            h('span', null, Array.from(content).length + ' 字'),
            h('span', null, '·'),
            h('span', null, '引用 ' + citations.length),
          ),
          err ? h('div', { className: 'iw-error', style: { margin: '6px 12px 0' } }, h(Icon, { name: 'x', size: 12 }), h('span', null, err)) : null,
          h(
            'div',
            { className: 'iw-ed-title' },
            h('input', { value: title, onChange: (e) => { setTitle(e.target.value); setDirty(true) }, placeholder: '报告标题' }),
            h('div', { className: 'meta' }, h('span', null, report.mode === 'quick' ? '快速模式' : '深度模式'), h('span', null, '·'), h('span', null, '最近保存 ' + fmtDate(report.updatedAt))),
          ),
          h(
            'div',
            { className: 'iw-ed-body' },
            h('textarea', {
              ref: textRef,
              value: content,
              onChange: (e) => { setContent(e.target.value); setDirty(true) },
              placeholder: '从「0 结论与投资含义」开始写。右侧可插入已确认卡片与大纲。',
              spellCheck: false,
            }),
          ),
        ),
        h(
          'div',
          { className: 'iw-side refs' },
          h(
            'div',
            { className: 'iw-side-h' },
            h('button', { className: tab === 'cards' ? 'iw-btn sm primary' : 'iw-btn sm ghost', onClick: () => setTab('cards') }, '卡片 ' + confirmed.length),
            h('button', { className: tab === 'assets' ? 'iw-btn sm primary' : 'iw-btn sm ghost', onClick: () => setTab('assets') }, '图表'),
            h('button', { className: tab === 'outline' ? 'iw-btn sm primary' : 'iw-btn sm ghost', onClick: () => setTab('outline') }, '大纲'),
          ),
          h(
            'div',
            { className: 'iw-refs' },
            tab === 'cards'
              ? confirmed.length
                ? confirmed.map((card) =>
                    h(
                      'div',
                      { key: card.id, className: 'iw-cardlet' },
                      h('div', { className: 'top' }, h('span', { className: 'board' }, card.board)),
                      h('h4', null, card.title),
                      h('div', { className: 'meta' }, h('span', null, (card.evidence || []).length + ' 条证据')),
                      h('div', { className: 'acts' }, h('button', { onClick: () => cite(card) }, h(Icon, { name: 'quote', size: 10 }), '引用到光标')),
                    ),
                  )
                : h(Empty, { title: '还没有已确认卡片', text: '去阅读台生成并确认卡片，或到知识库处理待确认项。' })
              : tab === 'assets'
                ? assets.length
                  ? assets.map((asset) =>
                      h(
                        'div',
                        { key: asset.id, className: 'iw-cardlet' },
                        h('div', { className: 'top' }, h('span', { className: 'board' }, asset.kind === 'figure' ? '图表' : '数据表'), h('span', { className: 'iw-grow' }), h('span', { className: 'iw-pill' }, asset.page ? 'p' + asset.page : '手动')),
                        h('h4', null, asset.title),
                        h('div', { className: 'meta' }, h('span', null, asset.caption || '—')),
                        h('div', { className: 'acts' }, h('button', { onClick: () => insertAsset(asset) }, h(Icon, { name: 'plus', size: 10 }), '插入正文')),
                      ),
                    )
                  : h(Empty, { title: '知识库还没有图表资产', text: '在阅读台「截取图表」，或到知识库新建数据表。' })
              : (report.outline || '').split('\n').filter(Boolean).map((line, index) =>
                  h('button', { key: index, className: 'iw-rep', onClick: () => insert('\n## ' + line + '\n') }, h('b', null, line), h('span', null, '点击插入到正文')),
                ),
          ),
        ),
      )
    }

    function assetImageUrl(asset) {
      return '/invest/api/assets/' + asset.id + '/image'
    }

    function assetAbsoluteImageUrl(asset) {
      const origin = typeof window !== 'undefined' && window.location ? window.location.origin : ''
      return origin + assetImageUrl(asset)
    }

    function assetTsv(asset) {
      const data = asset.data || {}
      const columns = data.columns || []
      const rows = data.rows || []
      return [columns, ...rows].map((row) => row.join('\t')).join('\n')
    }

    function assetMarkdown(asset) {
      const data = asset.data || {}
      const columns = data.columns || []
      const rows = data.rows || []
      const lines = []
      lines.push('| ' + columns.join(' | ') + ' |')
      lines.push('| ' + columns.map(() => '---').join(' | ') + ' |')
      for (const row of rows) lines.push('| ' + row.join(' | ') + ' |')
      const caption = asset.caption || asset.title
      lines.push('')
      lines.push('*' + caption + (asset.sourceNote ? '（来源：' + asset.sourceNote + '）' : '') + '*')
      return lines.join('\n')
    }

    function parseDelimited(text) {
      const lines = String(text || '')
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
      if (!lines.length) return { columns: [], rows: [] }
      const useTab = lines.some((line) => line.includes('\t'))
      const split = (line) => (useTab ? line.split('\t') : line.split(','))
      const columns = split(lines[0]).map((cell) => cell.trim()).filter(Boolean)
      const rows = lines.slice(1).map((line) => split(line).map((cell) => cell.trim()))
      return { columns, rows: rows.filter((row) => row.some(Boolean)) }
    }

    async function copyTextToClipboard(text) {
      try {
        await navigator.clipboard.writeText(text)
        return true
      } catch {
        return false
      }
    }

    async function copyAssetImage(asset) {
      try {
        const blob = await (await fetch(assetImageUrl(asset))).blob()
        if (typeof ClipboardItem === 'undefined' || !navigator.clipboard || !navigator.clipboard.write) throw new Error('no image clipboard')
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        return '图片已复制，可直接粘贴到 Word/PPT'
      } catch {
        const ok = await copyTextToClipboard(assetAbsoluteImageUrl(asset))
        return ok ? '当前环境不支持复制图片，已复制图片链接' : '复制失败，请在知识库右键图片另存'
      }
    }

    function FigureCapture(props) {
      const { source, onClose, notify } = props
      const [page, setPage] = useState(1)
      const [title, setTitle] = useState('')
      const [caption, setCaption] = useState('')
      const [sel, setSel] = useState(null)
      const [drag, setDrag] = useState(false)
      const [saving, setSaving] = useState(false)
      const [err, setErr] = useState('')
      const imgRef = useRef(null)
      const startRef = useRef(null)
      const pageUrl = '/invest/api/sources/' + source.id + '/page/' + page

      function point(event) {
        const rect = imgRef.current.getBoundingClientRect()
        return {
          x: Math.max(0, Math.min(event.clientX - rect.left, rect.width)),
          y: Math.max(0, Math.min(event.clientY - rect.top, rect.height)),
          width: rect.width,
          height: rect.height,
        }
      }

      function onDown(event) {
        const p = point(event)
        startRef.current = p
        setDrag(true)
        setSel({ x: p.x, y: p.y, w: 0, h: 0 })
      }

      function onMove(event) {
        if (!drag || !startRef.current) return
        const p = point(event)
        const start = startRef.current
        setSel({
          x: Math.min(start.x, p.x),
          y: Math.min(start.y, p.y),
          w: Math.abs(p.x - start.x),
          h: Math.abs(p.y - start.y),
        })
      }

      function onUp() {
        setDrag(false)
        startRef.current = null
      }

      async function save() {
        const img = imgRef.current
        if (!img || !sel || sel.w < 8 || sel.h < 8) {
          setErr('先在页面上拖出一个矩形区域')
          return
        }
        setSaving(true)
        setErr('')
        try {
          const scale = img.naturalWidth / img.clientWidth
          const canvas = document.createElement('canvas')
          canvas.width = Math.max(1, Math.round(sel.w * scale))
          canvas.height = Math.max(1, Math.round(sel.h * scale))
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, sel.x * scale, sel.y * scale, sel.w * scale, sel.h * scale, 0, 0, canvas.width, canvas.height)
          const image = canvas.toDataURL('image/png')
          await api('/assets/figure', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              sourceId: source.id,
              page,
              title: title.trim() || '第 ' + page + ' 页图表',
              caption: caption.trim(),
              sourceNote: source.title,
              image,
            }),
          })
          notify('已存入知识库 · 图表与数据')
          onClose()
        } catch (error) {
          setErr(error.message)
        } finally {
          setSaving(false)
        }
      }

      return h(
        'div',
        { className: 'iw-modal-mask' },
        h(
          'div',
          { className: 'iw-modal wide' },
          h('h3', null, '截取图表 · 存入知识库'),
          h('p', null, '在原文页上拖出图表或表格区域，保存后可在知识库复制图片，或插入报告。'),
          h(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' } },
            h('span', { className: 'iw-dim', style: { fontSize: '10px' } }, '页码'),
            h('input', {
              className: 'iw-input',
              type: 'number',
              min: 1,
              max: source.pageCount || 1,
              value: page,
              style: { width: '70px' },
              onChange: (event) => {
                const next = Math.max(1, Math.min(Number(event.target.value) || 1, source.pageCount || 1))
                setPage(next)
                setSel(null)
              },
            }),
            h('span', { className: 'iw-dim', style: { fontSize: '10px' } }, '/ ' + (source.pageCount || 1) + ' 页'),
            h('span', { className: 'iw-grow' }),
            h('span', { className: 'iw-dim', style: { fontSize: '10px' } }, sel ? '已选 ' + Math.round(sel.w) + '×' + Math.round(sel.h) : '未选择区域'),
          ),
          h(
            'div',
            { style: { maxHeight: '440px', overflow: 'auto', background: '#fff', borderRadius: '8px', textAlign: 'center' } },
            h(
              'div',
              { style: { position: 'relative', display: 'inline-block' } },
              h('img', {
                ref: imgRef,
                src: pageUrl,
                alt: '原文页',
                draggable: false,
                onMouseDown: onDown,
                onMouseMove: onMove,
                onMouseUp: onUp,
                onMouseLeave: onUp,
                style: { display: 'block', maxWidth: '100%', maxHeight: '440px', userSelect: 'none', cursor: 'crosshair' },
              }),
              sel
                ? h('div', { className: 'iw-crop', style: { left: sel.x, top: sel.y, width: sel.w, height: sel.h } })
                : null,
            ),
          ),
          err ? h('div', { className: 'iw-error', style: { marginTop: '8px' } }, h(Icon, { name: 'x', size: 12 }), h('span', null, err)) : null,
          h(
            'div',
            { style: { display: 'flex', gap: '8px', marginTop: '10px' } },
            h('input', { className: 'iw-input', placeholder: '图表标题（如：液冷渗透率）', value: title, onChange: (event) => setTitle(event.target.value) }),
            h('input', { className: 'iw-input', placeholder: '图注 / 口径（如：2023–2028E，%）', value: caption, onChange: (event) => setCaption(event.target.value) }),
          ),
          h(
            'div',
            { className: 'row', style: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' } },
            h('button', { className: 'iw-btn ghost', onClick: onClose }, '取消'),
            h('button', { className: 'iw-btn primary', onClick: save, disabled: saving }, saving ? '保存中…' : '存入知识库'),
          ),
        ),
      )
    }

    function TableModal(props) {
      const { source, asset, onClose, onSaved, notify } = props
      const [title, setTitle] = useState(asset ? asset.title : '数据表')
      const [caption, setCaption] = useState(asset ? asset.caption : '')
      const [sourceNote, setSourceNote] = useState(asset ? asset.sourceNote : source ? source.title : '')
      const [tsv, setTsv] = useState(asset ? assetTsv(asset) : '年份\t冷板式\t浸没式\n2025\t18%\t3%\n2026E\t27%\t6%')
      const [chartType, setChartType] = useState(asset ? asset.chartType : 'none')
      const [saving, setSaving] = useState(false)
      const [err, setErr] = useState('')
      const parsed = parseDelimited(tsv)

      async function save() {
        if (!parsed.columns.length || !parsed.rows.length) {
          setErr('表格至少需要 1 列 1 行；从 Excel 复制时整块粘贴进来')
          return
        }
        setSaving(true)
        setErr('')
        try {
          if (asset) {
            await api('/assets/' + encodeURIComponent(asset.id), {
              method: 'PATCH',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ title, caption, sourceNote, data: parsed, chartType }),
            })
            notify('数据表已更新')
          } else {
            await api('/assets/table', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ sourceId: source ? source.id : '', title, caption, sourceNote, columns: parsed.columns, rows: parsed.rows, chartType }),
            })
            notify('数据表已存入知识库')
          }
          onSaved()
          onClose()
        } catch (error) {
          setErr(error.message)
        } finally {
          setSaving(false)
        }
      }

      return h(
        'div',
        { className: 'iw-modal-mask' },
        h(
          'div',
          { className: 'iw-modal wide' },
          h('h3', null, asset ? '编辑数据表' : '新建数据表 · 存入知识库'),
          h('p', null, '从 PDF/Excel 复制整块表格粘贴到左侧；第一行是表头，用 Tab 或逗号分隔。右侧为解析预览。'),
          h(
            'div',
            { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' } },
            h('textarea', {
              className: 'iw-input',
              style: { height: '240px', padding: '8px', lineHeight: 1.7, resize: 'none', fontFamily: 'Consolas, monospace' },
              value: tsv,
              onChange: (event) => setTsv(event.target.value),
              placeholder: '年份\t冷板式\t浸没式\n2025\t18%\t3%',
            }),
            h(
              'div',
              { style: { maxHeight: '240px', overflow: 'auto', border: '1px solid #2A414D', borderRadius: '8px', background: '#fff' } },
              parsed.columns.length
                ? h(
                    'table',
                    { className: 'iw-preview-table' },
                    h('thead', null, h('tr', null, parsed.columns.map((column, index) => h('th', { key: index }, column)))),
                    h('tbody', null, parsed.rows.map((row, rowIndex) => h('tr', { key: rowIndex }, row.map((cell, cellIndex) => h('td', { key: cellIndex }, cell))))),
                  )
                : h('div', { style: { padding: '16px', color: '#6C7A80', fontSize: '11px' } }, '左侧粘贴后这里显示预览'),
            ),
          ),
          err ? h('div', { className: 'iw-error', style: { marginTop: '8px' } }, h(Icon, { name: 'x', size: 12 }), h('span', null, err)) : null,
          h(
            'div',
            { style: { display: 'flex', gap: '8px', marginTop: '10px' } },
            h('input', { className: 'iw-input', placeholder: '标题', value: title, onChange: (event) => setTitle(event.target.value) }),
            h('input', { className: 'iw-input', placeholder: '图注 / 口径', value: caption, onChange: (event) => setCaption(event.target.value) }),
            h('input', { className: 'iw-input', placeholder: '来源', value: sourceNote, onChange: (event) => setSourceNote(event.target.value) }),
            h(
              'select',
              { className: 'iw-select', style: { width: '110px' }, value: chartType, onChange: (event) => setChartType(event.target.value) },
              h('option', { value: 'none' }, '仅表格'),
              h('option', { value: 'bar' }, '柱状图'),
              h('option', { value: 'line' }, '折线图'),
              h('option', { value: 'pie' }, '饼图'),
            ),
          ),
          h(
            'div',
            { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' } },
            h('button', { className: 'iw-btn ghost', onClick: onClose }, '取消'),
            h('button', { className: 'iw-btn primary', onClick: save, disabled: saving }, saving ? '保存中…' : asset ? '保存修改' : '存入知识库'),
          ),
        ),
      )
    }

    function Library(props) {
      const { cards, onRefresh, notify } = props
      const [tab, setTab] = useState('cards')
      const [filter, setFilter] = useState('all')
      const [folder, setFolder] = useState('all')
      const [expanded, setExpanded] = useState('')
      const [err, setErr] = useState('')
      const [assets, setAssets] = useState([])
      const [tableModal, setTableModal] = useState(null)

      async function setStatus(card, status) {
        try {
          await api('/cards/' + encodeURIComponent(card.id), {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ status }),
          })
          await onRefresh()
          notify(status === 'confirmed' ? '已确认入库' : '已驳回')
        } catch (error) {
          setErr(error.message)
        }
      }

      async function loadAssets() {
        try {
          const data = await api('/assets')
          setAssets(data.assets || [])
        } catch (error) {
          setErr(error.message)
        }
      }

      useEffect(() => {
        if (tab === 'assets') loadAssets()
      }, [tab])

      async function deleteAsset(asset) {
        if (!window.confirm('删除「' + asset.title + '」？')) return
        try {
          await api('/assets/' + encodeURIComponent(asset.id), { method: 'DELETE' })
          await loadAssets()
          notify('已删除')
        } catch (error) {
          setErr(error.message)
        }
      }

      async function copyAsset(asset) {
        if (asset.kind === 'figure') {
          notify(await copyAssetImage(asset))
        } else {
          const ok = await copyTextToClipboard(assetTsv(asset))
          notify(ok ? '表格已复制，可直接粘贴到 Excel / Word' : '复制失败')
        }
      }

      const shown = (cards || []).filter((card) => {
        if (folder !== 'all' && (card.sourceId || '') !== folder) return false
        if (filter === 'pending') return card.status === 'ai_draft'
        if (filter === 'confirmed') return card.status === 'confirmed' || card.status === 'edited'
        if (filter === 'rejected') return card.status === 'rejected'
        return true
      })

      const cardFolders = (() => {
        const map = new Map()
        for (const card of cards || []) {
          const id = card.sourceId || ''
          if (!map.has(id)) map.set(id, { id, title: card.sourceTitle || '未归档', count: 0 })
          map.get(id).count += 1
        }
        return [...map.values()].sort((a, b) => b.count - a.count)
      })()

      const assetsBody = assets.length
        ? assets.map((asset) =>
            h(
              'div',
              { key: asset.id, className: 'iw-asset' },
              asset.kind === 'figure'
                ? h('img', { src: assetImageUrl(asset), alt: asset.title })
                : h(
                    'div',
                    { style: { width: '120px', height: '78px', background: '#fff', borderRadius: '6px', border: '1px solid #22353F', overflow: 'hidden', padding: '4px', flex: 'none' } },
                    h(
                      'table',
                      { className: 'iw-preview-table' },
                      h('thead', null, h('tr', null, (asset.data.columns || []).slice(0, 3).map((column, index) => h('th', { key: index }, column)))),
                      h('tbody', null, (asset.data.rows || []).slice(0, 3).map((row, rowIndex) => h('tr', { key: rowIndex }, row.slice(0, 3).map((cell, cellIndex) => h('td', { key: cellIndex }, cell))))),
                    ),
                  ),
              h(
                'div',
                { className: 'info' },
                h('b', null, asset.title),
                h('p', null, (asset.caption || '无图注') + (asset.sourceNote ? ' · ' + asset.sourceNote : '')),
                h(
                  'div',
                  { className: 'acts' },
                  h('button', { className: 'iw-btn sm ghost', onClick: () => copyAsset(asset) }, asset.kind === 'figure' ? '复制图片' : '复制表格'),
                  asset.kind === 'table'
                    ? h('button', { className: 'iw-btn sm ghost', onClick: () => setTableModal(asset) }, '编辑')
                    : null,
                  h('button', { className: 'iw-btn sm ghost', onClick: () => deleteAsset(asset), style: { color: '#E0A0A0' } }, '删除'),
                ),
              ),
            ),
          )
        : h(Empty, { title: '还没有图表或数据资产', text: '在阅读台打开原文页「截取图表」，或点右上「新建数据表」粘贴一块表格。' })

      return h(
        'div',
        { className: 'iw-lib' },
        h(
          'div',
          { className: 'iw-row', style: { marginBottom: '8px' } },
          h('h2', { className: 'iw-h2' }, '知识库'),
          h('span', { className: 'iw-pill' }, tab === 'cards' ? (cards || []).length + ' 张卡片' : assets.length + ' 个资产'),
          h('span', { className: 'iw-grow' }),
          h('button', { className: 'iw-btn sm primary', onClick: () => setTab('cards') }, '卡片'),
          tab === 'assets' ? h('button', { className: 'iw-btn sm', onClick: () => setTableModal('new') }, '＋ 新建数据表') : null,
          h('button', { className: 'iw-btn sm ghost', onClick: tab === 'assets' ? loadAssets : onRefresh }, '刷新'),
        ),
        err ? h('div', { className: 'iw-error' }, h(Icon, { name: 'x', size: 12 }), h('span', null, err)) : null,
        tab === 'cards'
          ? h(
              'div',
              { className: 'iw-lib-body' },
              h(
                'aside',
                { className: 'iw-folders' },
                h('div', { className: 'h' }, '文档文件夹'),
                h(
                  'button',
                  { className: folder === 'all' ? 'on' : '', onClick: () => setFolder('all') },
                  h(Icon, { name: 'grid', size: 13 }),
                  h('span', { className: 't' }, '全部卡片'),
                  h('span', { className: 'n' }, (cards || []).length),
                ),
                cardFolders.map((item) =>
                  h(
                    'button',
                    { key: item.id || 'none', className: folder === item.id ? 'on' : '', onClick: () => setFolder(item.id) },
                    h(Icon, { name: 'book', size: 13 }),
                    h('span', { className: 't' }, item.title),
                    h('span', { className: 'n' }, item.count),
                  ),
                ),
              ),
              h(
                'div',
                { className: 'iw-lib-main' },
              h(
                'div',
                { className: 'iw-filters' },
                [['all', '全部'], ['pending', '待确认'], ['confirmed', '已确认'], ['rejected', '已驳回']].map(([key, label]) =>
                  h('button', { key, className: filter === key ? 'on' : '', onClick: () => setFilter(key) }, label),
                ),
              ),
              h(
                'div',
                { className: 'iw-lib-table' },
                shown.length
                  ? shown.map((card) =>
                      h(
                        'div',
                        { key: card.id, className: 'iw-lib-row', onClick: () => setExpanded(expanded === card.id ? '' : card.id) },
                        h('div', { className: 'b' }, card.board),
                        h('div', null, h('div', { className: 'tt' }, card.title), h('div', { className: 'src' }, card.sourceTitle || '—')),
                        h('div', { className: 'src' }, fmtDate(card.updatedAt)),
                        h('div', { className: 'st' }, statusPill(card.status)),
                        expanded === card.id
                          ? h(
                              'div',
                              { className: 'iw-lib-detail' },
                              h('div', null, '论点：' + card.thesis),
                              (card.points || []).map((point, index) => h('div', { key: index, style: { marginTop: '3px' } }, '· ' + point)),
                              (card.evidence || []).map((evidence, index) =>
                                h('div', { key: index, style: { marginTop: '3px' } }, h('b', null, evidence.blockId + '：'), evidence.quote),
                              ),
                              card.status === 'ai_draft'
                                ? h(
                                    'div',
                                    { className: 'row', style: { marginTop: '7px', gap: '6px' } },
                                    h('button', { className: 'iw-btn sm primary', onClick: (event) => { event.stopPropagation(); setStatus(card, 'confirmed') } }, '确认入库'),
                                    h('button', { className: 'iw-btn sm ghost', onClick: (event) => { event.stopPropagation(); setStatus(card, 'rejected') } }, '驳回'),
                                  )
                                : null,
                            )
                          : null,
                      ),
                    )
                  : h(Empty, { title: '没有符合条件的卡片', text: '去阅读台生成五板块，或在筛选里切换状态。' }),
              ),
              ),
            )
          : h('div', { className: 'iw-lib-table', style: { overflow: 'auto' } }, assetsBody),
        tableModal
          ? h(TableModal, {
              source: null,
              asset: tableModal === 'new' ? null : tableModal,
              onClose: () => setTableModal(null),
              onSaved: loadAssets,
              notify,
            })
          : null,
      )
    }

    function makeAsk(ctx, sessionId) {
      return async function ask(text) {
        const sessions = typeof ctx.get === 'function' ? ctx.get('sessions') : ctx.sessions
        if (!sessions || typeof sessions.scope !== 'function') throw new Error('会话服务不可用')
        const actx = sessions.scope(sessionId)
        const conversation = actx && typeof actx.get === 'function' ? actx.get('conversation') : undefined
        if (!conversation || typeof conversation.send !== 'function') throw new Error('没有正在进行的会话')
        await conversation.send(text)
      }
    }

    function pageMap(blocks) {
      let page = 0
      return (blocks || []).map((block) => {
        const match = /^【第\s*(\d+)\s*页】/.exec(block.text || '')
        if (match) page = Number(match[1])
        return page
      })
    }

    function ReaderPane(props) {
      const { ask } = props
      const [sources, setSources] = useState([])
      const [source, setSource] = useState(null)
      const [quote, setQuote] = useState('')
      const [page, setPage] = useState(0)
      const [question, setQuestion] = useState('')
      const [busy, setBusy] = useState(false)
      const [note, setNote] = useState('')
      const [err, setErr] = useState('')
      const docRef = useRef(null)

      useEffect(() => {
        api('/sources')
          .then((data) => {
            const list = data.sources || []
            setSources(list)
            let preferred = ''
            try {
              preferred = window.localStorage.getItem('iw-reader-source') || ''
            } catch {
              preferred = ''
            }
            const target = list.find((item) => item.id === preferred) || list[0]
            if (target) {
              api('/sources/' + target.id)
                .then((detail) => setSource(detail.source))
                .catch((error) => setErr(error.message))
            }
          })
          .catch((error) => setErr(error.message))
      }, [])

      async function pick(sourceId) {
        setErr('')
        setQuote('')
        setPage(0)
        try {
          const data = await api('/sources/' + encodeURIComponent(sourceId))
          setSource(data.source)
        } catch (error) {
          setErr(error.message)
        }
      }

      function onPick(event) {
        const node = event.target
        if (!(node instanceof Node) || !docRef.current || !docRef.current.contains(node)) return
        const selection = window.getSelection()
        const text = selection ? selection.toString().replace(/\s+/g, ' ').trim() : ''
        if (!text) return
        const element = node.nodeType === 1 ? node : node.parentElement
        const holder = element && element.closest ? element.closest('[data-page]') : null
        setQuote(text.slice(0, 1200))
        setPage(holder ? Number(holder.getAttribute('data-page')) || 0 : 0)
        setNote('')
      }

      async function send() {
        if (!source || !quote || busy) return
        setBusy(true)
        setErr('')
        setNote('')
        try {
          const text = [
            '《' + source.title + '》' + (page ? ' p.' + page : ''),
            quote,
            question.trim() || '请结合这段解释，并给出处。',
          ].join('\n')
          await ask(text)
          setNote('已发送到对话，去主对话看回答')
          setQuote('')
          setQuestion('')
        } catch (error) {
          setErr(error.message)
        } finally {
          setBusy(false)
        }
      }

      const pages = pageMap(source ? source.blocks : [])
      return h(
        'div',
        { className: 'iw-rp' },
        h(
          'div',
          { className: 'iw-rp-h' },
          h(Icon, { name: 'book', size: 14 }),
          h('b', null, '研读'),
          h('span', { className: 'iw-grow' }),
          h(
            'select',
            {
              className: 'iw-select',
              style: { width: '58%', height: '24px', padding: '0 6px', fontSize: '10px' },
              value: source ? source.id : '',
              onChange: (event) => pick(event.target.value),
            },
            sources.map((item) => h('option', { key: item.id, value: item.id }, item.title)),
          ),
        ),
        err ? h('div', { className: 'iw-error', style: { margin: '6px 8px 0' } }, h(Icon, { name: 'x', size: 12 }), h('span', null, err)) : null,
        source
          ? h(
              'div',
              { className: 'iw-rp-doc', ref: docRef, onMouseUp: onPick },
              (source.blocks || []).map((block, index) => {
                const isMarker = /^【第\s*\d+\s*页】/.test(block.text)
                return h(
                  'p',
                  {
                    key: block.id,
                    'data-page': pages[index] || 0,
                    className: 'iw-rp-block' + (block.heading || isMarker ? ' heading' : ''),
                  },
                  block.text,
                )
              }),
            )
          : h(Empty, { title: '还没有资料', text: '先在「研读台」导入一份研报。' }),
        quote
          ? h(
              'div',
              { className: 'iw-rp-bar' },
              h('div', { className: 'q' }, '“' + (quote.length > 110 ? quote.slice(0, 110) + '…' : quote) + '”', h('span', null, page ? ' p.' + page : '')),
              h('textarea', {
                value: question,
                placeholder: '问什么？可留空，默认请它解释并给出处。',
                onChange: (event) => setQuestion(event.target.value),
                onKeyDown: (event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    send()
                  }
                },
              }),
              h(
                'div',
                { className: 'row' },
                h('span', { className: 'hint' }, 'Enter 发送 · 选中文字后出现'),
                h('span', { className: 'iw-grow' }),
                h('button', { className: 'iw-btn sm ghost', onClick: () => { setQuote(''); setQuestion('') } }, '取消'),
                h('button', { className: 'iw-btn sm primary', onClick: send, disabled: busy }, busy ? '发送中…' : '丢回对话'),
              ),
            )
          : null,
        note ? h('div', { className: 'iw-rp-note' }, note) : null,
      )
    }

    class Boundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { error: null }
      }
      static getDerivedStateFromError(error) {
        return { error }
      }
      componentDidCatch(error, info) {
        console.error('[invest-workbench] render failed', error, info)
        diag('boundary-error', {
          message: String((error && error.message) || error),
          stack: error && error.stack,
          componentStack: info && info.componentStack,
        })
      }
      render() {
        if (this.state.error) {
          const message = this.state.error && this.state.error.stack ? this.state.error.stack : String(this.state.error)
          return h(
            'div',
            { className: 'iw-fatal' },
            h('b', null, '研读台渲染出错（v0.1.2）'),
            h('pre', null, message),
            h('p', null, '把这段报错发我，我按真实堆栈修。'),
          )
        }
        return this.props.children
      }
    }

    function ChartLibrary(props) {
      const { notify } = props
      const [sources, setSources] = useState([])
      const [assets, setAssets] = useState([])
      const [selected, setSelected] = useState('all')
      const [preview, setPreview] = useState(null)
      const [err, setErr] = useState('')

      const load = useCallback(async () => {
        try {
          const [sourceData, assetData] = await Promise.all([api('/sources'), api('/assets')])
          setSources(sourceData.sources || [])
          setAssets(assetData.assets || [])
          setErr('')
        } catch (error) {
          setErr(error.message)
        }
      }, [])

      useEffect(() => {
        load()
      }, [load])

      const figures = assets.filter((asset) => asset.kind === 'figure')
      const folders = sources.map((source) => ({
        ...source,
        count: figures.filter((asset) => asset.sourceId === source.id).length,
      }))
      const shown = selected === 'all' ? figures : figures.filter((asset) => asset.sourceId === selected)
      const current = folders.find((folder) => folder.id === selected)

      async function copy(asset) {
        notify(await copyAssetImage(asset))
      }

      async function remove(asset) {
        if (!window.confirm('删除这张图表？')) return
        try {
          await api('/assets/' + encodeURIComponent(asset.id), { method: 'DELETE' })
          setPreview(null)
          await load()
          notify('已删除')
        } catch (error) {
          setErr(error.message)
        }
      }

      return h(
        'div',
        { className: 'iw-chartlib' },
        h(
          'aside',
          { className: 'iw-folders' },
          h('div', { className: 'h' }, '按文档归档'),
          h(
            'button',
            { className: selected === 'all' ? 'on' : '', onClick: () => setSelected('all') },
            h(Icon, { name: 'grid', size: 13 }),
            h('span', { className: 't' }, '全部图表'),
            h('span', { className: 'n' }, figures.length),
          ),
          folders.map((folder) =>
            h(
              'button',
              { key: folder.id, className: selected === folder.id ? 'on' : '', onClick: () => setSelected(folder.id) },
              h(Icon, { name: 'book', size: 13 }),
              h('span', { className: 't' }, folder.title),
              h('span', { className: 'n' }, folder.count),
            ),
          ),
        ),
        h(
          'main',
          { className: 'iw-chartmain' },
          h(
            'div',
            { className: 'h' },
            h('b', null, selected === 'all' ? '全部图表' : current ? current.title : '文档'),
            h('span', null, shown.length + ' 张'),
            h('span', { className: 'iw-grow' }),
            h('button', { className: 'iw-btn sm ghost', onClick: load }, '刷新'),
          ),
          err ? h('div', { className: 'iw-error', style: { margin: '8px 14px 0' } }, h(Icon, { name: 'x', size: 12 }), h('span', null, err)) : null,
          h(
            'div',
            { className: 'iw-chartgrid' },
            shown.length
              ? shown.map((asset) =>
                  h(
                    'div',
                    { key: asset.id, className: 'iw-chartcard' },
                    h('img', { src: assetImageUrl(asset), alt: asset.title, onClick: () => setPreview(asset) }),
                    h(
                      'div',
                      { className: 'info' },
                      h('b', null, asset.title),
                      h('span', null, (asset.page ? 'p.' + asset.page + ' · ' : '') + (asset.caption || asset.sourceNote || '')),
                      h(
                        'div',
                        { className: 'acts' },
                        h('button', { onClick: () => copy(asset) }, '复制图片'),
                        h('button', { className: 'no', onClick: () => remove(asset) }, '删除'),
                      ),
                    ),
                  ),
                )
              : h(Empty, {
                  title: selected === 'all' ? '图表库还是空的' : '这个文档还没有图表',
                  text: '上传 PDF 或在阅读台点「重新解析 / 提取图表」，图表会按文档自动归档到这里。',
                }),
          ),
        ),
        preview
          ? h(
              'div',
              { className: 'iw-modal-mask', onClick: (event) => { if (event.target === event.currentTarget) setPreview(null) } },
              h(
                'div',
                { className: 'iw-modal wide' },
                h('h3', null, preview.title),
                h('div', { className: 'iw-chart-preview' }, h('img', { src: assetImageUrl(preview), alt: preview.title })),
                h('p', null, (preview.caption || '') + (preview.sourceNote ? ' · ' + preview.sourceNote : '') + (preview.page ? ' · p.' + preview.page : '')),
                h(
                  'div',
                  { className: 'row', style: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' } },
                  h('button', { className: 'iw-btn ghost', onClick: () => setPreview(null) }, '关闭'),
                  h('button', { className: 'iw-btn ghost', onClick: () => copy(preview) }, '复制图片'),
                  h('button', { className: 'iw-btn primary', onClick: () => remove(preview) }, '删除'),
                ),
              ),
            )
          : null,
      )
    }

    function App(props) {
      const [view, setView] = useState('home')
      const [overview, setOverview] = useState(null)
      const [sources, setSources] = useState([])
      const [cards, setCards] = useState([])
      const [reports, setReports] = useState([])
      const [source, setSource] = useState(null)
      const [report, setReport] = useState(null)
      const [toast, setToast] = useState('')
      const [busy, setBusy] = useState('')
      const [error, setError] = useState('')

      const notify = useCallback((text) => {
        setToast(text)
        window.setTimeout(() => setToast(''), 2400)
      }, [])

      const loadOverview = useCallback(async () => {
        try {
          const data = await api('/overview')
          setOverview(data)
          setError('')
        } catch (err) {
          setError(err.message)
        }
      }, [])

      const loadLearn = useCallback(async () => {
        try {
          const data = await api('/sources')
          setSources(data.sources || [])
        } catch (err) {
          setError(err.message)
        }
      }, [])

      const loadLibrary = useCallback(async () => {
        try {
          const data = await api('/cards')
          setCards(data.cards || [])
        } catch (err) {
          setError(err.message)
        }
      }, [])

      useEffect(() => {
        const timer = window.setTimeout(() => {
          const el = document.querySelector('.dsh-iw')
          if (!el) return
          const rect = el.getBoundingClientRect()
          diag('app-mount', {
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            text: (el.innerText || '').slice(0, 160),
          })
        }, 500)
        return () => window.clearTimeout(timer)
      }, [])

      useEffect(() => {
        loadOverview()
      }, [loadOverview])

      useEffect(() => {
        if (view === 'learn') loadLearn()
        if (view === 'library') loadLibrary()
        if (view === 'write') {
          api('/reports')
            .then((data) => setReports(data.reports || []))
            .catch((err) => setError(err.message))
          api('/cards')
            .then((data) => setCards(data.cards || []))
            .catch((err) => setError(err.message))
        }
      }, [view, loadLearn, loadLibrary])

      async function openSource(sourceId) {
        setBusy('source')
        try {
          const data = await api('/sources/' + encodeURIComponent(sourceId))
          setSource(data.source)
          setView('reader')
          setError('')
        } catch (err) {
          setError(err.message)
        } finally {
          setBusy('')
        }
      }

      async function openReport(reportId) {
        setBusy('report')
        try {
          const data = await api('/reports/' + encodeURIComponent(reportId))
          setReport(data.report)
          setView('write')
          setError('')
        } catch (err) {
          setError(err.message)
        } finally {
          setBusy('')
        }
      }

      async function importDemo() {
        setBusy('demo')
        try {
          await api('/demo', { method: 'POST' })
          await loadOverview()
          await loadLearn()
          notify('示例资料已写入，去「学习」打开阅读台')
        } catch (err) {
          setError(err.message)
        } finally {
          setBusy('')
        }
      }

      async function createReport() {
        setBusy('create')
        try {
          const data = await api('/reports', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ title: '液冷：从主题到订单', mode: 'deep' }),
          })
          setReport(data.report)
          setView('write')
          setReports((prev) => [{ id: data.report.id, title: data.report.title, mode: data.report.mode, status: data.report.status, words: 0 }, ...prev])
          notify('报告已创建')
        } catch (err) {
          setError(err.message)
        } finally {
          setBusy('')
        }
      }

      async function deleteSource(sourceId) {
        try {
          await api('/sources/' + encodeURIComponent(sourceId), { method: 'DELETE' })
          await loadLearn()
          await loadOverview()
          if (source && source.id === sourceId) {
            setSource(null)
            setView('learn')
          }
          notify('已删除')
        } catch (err) {
          setError(err.message)
        }
      }

      function refreshSource(updated) {
        setSource(updated)
      }

      const tabs = [
        ['home', '工作台'],
        ['learn', '学习'],
        ['write', '撰写'],
        ['library', '知识库'],
        ['charts', '图表库'],
      ]

      return h(
        'div',
        {
          className: 'dsh-iw',
          style: {
            background: 'var(--bg)',
            color: 'var(--ink)',
            height: '100%',
            minHeight: 640,
            display: 'flex',
            flexDirection: 'column',
          },
        },
        h(
          'div',
          { className: 'iw-top' },
          h('div', { className: 'iw-mark' }, '研'),
          h('div', { className: 'iw-brand' }, h('b', null, '研读台'), h('span', null, 'DSH PLUGIN · v' + VERSION)),
          h('div', { className: 'iw-proj' }, h('i'), 'AI 数据中心 · 液冷'),
          h(
            'div',
            { className: 'iw-tabs' },
            tabs.map(([key, label]) =>
              h(
                'button',
                {
                  key,
                  className: view === key || (view === 'reader' && key === 'learn') ? 'on' : '',
                  onClick: () => setView(key),
                },
                label,
              ),
            ),
          ),
          h('span', { className: 'iw-spacer' }),
          overview && overview.counts.pending
            ? h('span', { className: 'iw-pill ai', title: '待确认卡片', style: { cursor: 'pointer' }, onClick: () => setView('library') }, '待确认 ' + overview.counts.pending)
            : null,
          h('button', { className: 'iw-btn sm ghost', onClick: () => { loadOverview(); if (view === 'learn') loadLearn(); if (view === 'library') loadLibrary() } }, '刷新'),
        ),
        error
          ? h('div', { className: 'iw-error', style: { margin: '8px 14px 0' } }, h(Icon, { name: 'x', size: 12 }), h('span', { className: 'iw-grow' }, error), h('button', { className: 'iw-btn sm ghost', onClick: () => setError('') }, '关闭'))
          : null,
        h(
          'div',
          { className: 'iw-main' },
          view === 'home' ? h(Home, { overview, busy, onImport: () => setView('learn'), onNewReport: createReport, onDemo: importDemo, onOpenSource: openSource, onOpenReport: openReport, toast }) : null,
          view === 'learn' ? h(Learn, { sources, busy, onOpen: openSource, onDelete: deleteSource, onRefresh: async (openId) => { await loadLearn(); await loadOverview(); if (openId) await openSource(openId) }, toast }) : null,
          view === 'reader' && source ? h(Reader, { source, onBack: () => setView('learn'), onSource: refreshSource, notify }) : null,
          view === 'reader' && !source ? h(Empty, { title: '没有打开的文档', text: '回「学习」选一份资料。' }) : null,
          view === 'write' ? h(Writer, { report, reports, cards, onOpenReport: openReport, onCreate: createReport, onReport: setReport, onGoLibrary: () => setView('library'), notify }) : null,
          view === 'library' ? h(Library, { cards, onRefresh: loadLibrary, notify }) : null,
          view === 'charts' ? h(ChartLibrary, { notify }) : null,
        ),
        h(Toast, { text: toast }),
      )
    }

    function apply(ctx) {
      ctx.effect(() => {
        if (typeof window === 'undefined' || !window.addEventListener) return () => {}
        const send = (kind, payload) => {
          try {
            fetch('/invest/api/client-error', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(Object.assign({ kind, version: VERSION, at: new Date().toISOString() }, payload)),
            })
          } catch {
            /* diagnostics must never break the panel */
          }
        }
        const onError = (event) => send('window-error', { message: event.message, stack: event.error && event.error.stack, source: event.filename, line: event.lineno })
        const onRejection = (event) => {
          const reason = event.reason
          send('unhandled-rejection', { message: String((reason && reason.message) || reason), stack: reason && reason.stack })
        }
        window.addEventListener('error', onError)
        window.addEventListener('unhandledrejection', onRejection)
        send('client-loaded', { href: window.location && window.location.href })
        const timer = window.setTimeout(() => {
          const el = document.querySelector('.dsh-iw')
          if (!el) return send('mount-missing', {})
          const rect = el.getBoundingClientRect()
          send('mount-rect', { width: Math.round(rect.width), height: Math.round(rect.height), text: (el.innerText || '').slice(0, 120) })
        }, 1200)
        return () => {
          window.removeEventListener('error', onError)
          window.removeEventListener('unhandledrejection', onRejection)
          window.clearTimeout(timer)
        }
      }, 'invest-workbench: diagnostics')

      ctx.effect(() => {
        if (typeof document === 'undefined' || !document.head) return () => {}
        const id = 'dsh-iw-scoped-style'
        if (document.getElementById(id)) return () => {}
        const el = document.createElement('style')
        el.id = id
        el.textContent = CSS
        document.head.appendChild(el)
        return () => {
          if (el.parentNode) el.parentNode.removeChild(el)
        }
      }, 'invest-workbench: scoped css')

      ctx.slots.inject('main', () =>
        ctx.slots.register({ name: 'main', key: PANEL_ID }, function () {
          return h(Boundary, null, h(App))
        }),
      )
      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register(
          {
            name: 'sidebar.panellist',
            id: PANEL_ID,
            order: -9,
            label: () => '研读台',
          },
          function PanelIcon(props) {
            const size = (props && props.size) || 18
            return h(
              'svg',
              { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true', style: { display: 'block' } },
              h('path', { d: 'M6 3.5h8l4 4v13H6z', stroke: 'currentColor', strokeWidth: 1.6, strokeLinejoin: 'round' }),
              h('path', { d: 'M14 3.5v4h4', stroke: 'currentColor', strokeWidth: 1.6, strokeLinejoin: 'round' }),
              h('path', { d: 'M9 12h6M9 15.5h6', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' }),
              h('path', { d: 'M16.6 15.2l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z', fill: 'currentColor' }),
            )
          },
        ),
      )
    }

    return { inject: ['slots'], apply, __components: { App, Home, Learn, Reader, Writer, Library, FigureCapture, TableModal, ReaderPane, PdfPageView, ChartLibrary }, __internals: { makeAsk, pageMap } }
  },
})
