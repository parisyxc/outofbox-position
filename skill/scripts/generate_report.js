#!/usr/bin/env node
/*
 * Momentum Verification Analysis — report generator
 * Usage:  node generate_report.js <config.json> [output.docx]
 *
 * Renders a branded .docx in the house "Identify with Momentum, Verify with
 * Fundamentals" format from a single JSON config. See config.schema.md and the
 * example config for the full field list. Every section except `verdict` and
 * `parts` is optional — omit a key and that block is skipped.
 *
 * Requires: npm install -g docx   (or a local node_modules with `docx`)
 */
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Footer, AlignmentType, BorderStyle, WidthType, ShadingType, PageNumber,
} = require("docx");

// ---------- palette ----------
const C = {
  navy:"1a365d", teal:"2C7A7B", green:"276749", lgreen:"c6f6d5",
  red:"c53030", lred:"fed7d7", orange:"c05621", lorange:"feebc8",
  purple:"553c9a", lpurple:"e9d8fd", gray:"718096", lgray:"f7fafc",
  white:"FFFFFF", border:"CBD5E0", ink:"2D3748", inkSoft:"4A5568",
  onDarkSoft:"E2E8F0", onNavyTint:"BEE3F8", onOrangeTint:"FEE2C8",
};
// tone -> {fill (light bg), head (heading text), text (body text), banner (solid bg)}
const TONE = {
  bull:    {fill:C.lgreen,  head:C.green,  text:C.green,  banner:C.green},
  bear:    {fill:C.lred,    head:C.red,    text:C.red,    banner:C.red},
  caution: {fill:C.lorange, head:C.orange, text:C.orange, banner:C.orange},
  neutral: {fill:C.lgray,   head:C.navy,   text:C.navy,   banner:C.navy},
  info:    {fill:C.lpurple, head:C.purple, text:C.purple, banner:C.teal},
  navy:    {fill:C.lgray,   head:C.navy,   text:C.navy,   banner:C.navy},
};
function tone(t){ return TONE[t] || TONE.neutral; }

const CW = 9360;
const bd = {style:BorderStyle.SINGLE, size:1, color:C.border};
const bds = {top:bd,bottom:bd,left:bd,right:bd};
const nobd = {style:BorderStyle.NONE, size:0, color:C.white};
const nobds = {top:nobd,bottom:nobd,left:nobd,right:nobd};

const R = (t,o={}) => new TextRun({text:String(t==null?"":t), font:"Arial", ...o});
const P = (runs,o={}) => new Paragraph({children:Array.isArray(runs)?runs:[runs], ...o});
const spacer = (h=110) => new Paragraph({children:[R("")], spacing:{after:h}});

function banner(lines, fill){
  return new Table({ width:{size:CW,type:WidthType.DXA}, columnWidths:[CW], borders:nobds,
    rows:[new TableRow({children:[new TableCell({
      width:{size:CW,type:WidthType.DXA}, borders:nobds,
      shading:{fill,type:ShadingType.CLEAR}, margins:{top:160,bottom:160,left:200,right:200},
      children:lines })]})]});
}
function h2(t){
  return new Paragraph({ spacing:{before:260,after:120},
    border:{bottom:{style:BorderStyle.SINGLE,size:6,color:C.teal,space:2}},
    children:[R(t,{bold:true,size:26,color:C.navy})] });
}
function bullets(arr,color=C.ink,size=19){
  return (arr||[]).map(t => P(R(t,{size,color}), {spacing:{after:50}, indent:{left:120}}));
}
function colCell(box, w=4680){
  const tn = tone(box.tone);
  const kids = [P(R(box.title,{bold:true,size:22,color:tn.head}), {spacing:{after:80}})];
  // box may use `bullets` (string[]) or `blocks` ([{heading, bullets[]}])
  if (box.blocks){
    box.blocks.forEach((b,i)=>{
      kids.push(P(R(b.heading,{bold:true,size:19,color:C.navy}),
        {spacing:{before:i?60:0, after:30}}));
      bullets(b.bullets).forEach(p=>kids.push(p));
    });
  } else {
    bullets(box.bullets).forEach(p=>kids.push(p));
  }
  return new TableCell({ width:{size:w,type:WidthType.DXA}, borders:nobds,
    shading:{fill:tn.fill,type:ShadingType.CLEAR}, margins:{top:140,bottom:140,left:160,right:160},
    children:kids });
}
function twoCol(boxes){
  return new Table({ width:{size:CW,type:WidthType.DXA}, columnWidths:[4680,4680], borders:nobds,
    rows:[new TableRow({children:boxes.map(b=>colCell(b))})] });
}

// ---- data tables ----
function coerce(cell){ return (cell && typeof cell==="object" && !Array.isArray(cell)) ? cell : {t:cell}; }
function hcell(t,w,fill=C.navy){
  return new TableCell({width:{size:w,type:WidthType.DXA}, borders:bds,
    shading:{fill,type:ShadingType.CLEAR}, margins:{top:80,bottom:80,left:120,right:120},
    children:[P(R(t,{bold:true,color:C.white,size:19}))]});
}
function dcell(cell,w){
  const o = coerce(cell);
  const txtColor = o.color || (o.tone ? tone(o.tone).text : C.ink);
  const fill = o.fill || (o.cellTone ? tone(o.cellTone).fill : C.white);
  return new TableCell({width:{size:w,type:WidthType.DXA}, borders:bds,
    shading:{fill,type:ShadingType.CLEAR}, margins:{top:70,bottom:70,left:120,right:120},
    children:[P(R(o.t,{size:18,color:txtColor,bold:!!o.bold}))]});
}
function dataTable(widths, headers, rows, headFill=C.navy){
  return new Table({ width:{size:CW,type:WidthType.DXA}, columnWidths:widths,
    rows:[ new TableRow({tableHeader:true, children:headers.map((h,i)=>hcell(h,widths[i],headFill))}),
      ...rows.map(r=>new TableRow({children:r.map((c,i)=>dcell(c,widths[i]))})) ]});
}
// even column widths summing to CW
function evenWidths(n){ const w=Math.floor(CW/n); const a=Array(n).fill(w); a[n-1]+=CW-w*n; return a; }

// ================= BUILD =================
function build(cfg){
  const kids = [];
  const philosophy = cfg.philosophy || "Identify with Momentum, Verify with Fundamentals";

  // ----- title -----
  kids.push(banner([
    P(R("MOMENTUM VERIFICATION ANALYSIS",{bold:true,size:20,color:C.onNavyTint}), {spacing:{after:40}}),
    P(R(`${cfg.ticker} — ${(cfg.company||"").toUpperCase()}`,{bold:true,size:40,color:C.white}), {spacing:{after:40}}),
    cfg.sector ? P(R(cfg.sector,{size:18,color:C.onDarkSoft}), {spacing:{after:40}}) : spacer(0),
    P([ R(`Analysis Date: ${cfg.date||""}     `,{size:18,color:C.onDarkSoft}),
        R(`“${philosophy}”`,{italics:true,size:18,color:C.onNavyTint}) ]),
  ], C.navy));
  kids.push(spacer(120));

  // ----- verdict banner -----
  const v = cfg.verdict || {};
  kids.push(banner([
    P(R(`VERDICT:  ${v.headline||""}`,{bold:true,size:26,color:C.white}), {spacing:{after:60}}),
    P(R(`FRAMEWORK SCORE:  ${v.score||""}`,{bold:true,size:30,color:C.white}), {spacing:{after:40}}),
    v.subhead ? P(R(v.subhead,{bold:true,size:18,color:C.onOrangeTint}), {spacing:{after:80}}) : spacer(0),
    v.summary ? P(R(v.summary,{size:18,color:C.white})) : spacer(0),
  ], tone(v.tone).banner));
  kids.push(spacer(120));

  // ----- three zone boxes -----
  if (cfg.zones && cfg.zones.length){
    const w = evenWidths(cfg.zones.length);
    kids.push(new Table({ width:{size:CW,type:WidthType.DXA}, columnWidths:w, borders:nobds,
      rows:[new TableRow({children:cfg.zones.map((z,i)=>{
        const tn = tone(z.tone);
        return new TableCell({width:{size:w[i],type:WidthType.DXA}, borders:nobds,
          shading:{fill:tn.fill,type:ShadingType.CLEAR}, margins:{top:140,bottom:140,left:140,right:140},
          children:[
            P(R(z.label,{bold:true,size:20,color:tn.head}), {alignment:AlignmentType.CENTER}),
            P(R(z.value,{bold:true,size:26,color:C.navy}), {alignment:AlignmentType.CENTER}),
            z.note ? P(R(z.note,{size:16,color:C.inkSoft}), {alignment:AlignmentType.CENTER}) : spacer(0),
          ]});
      })})]}));
    kids.push(spacer(120));
  }

  // ----- divergence (technical vs fundamental) -----
  if (cfg.divergence){
    const d = cfg.divergence;
    kids.push(h2(d.title || `Is ${cfg.ticker} Diverging?`));
    kids.push(twoCol([ d.tech, d.fund ]));
    if (d.assessment){
      kids.push(spacer(60));
      const at = d.assessment;
      kids.push(banner([
        at.heading ? P(R(at.heading,{bold:true,size:19,color:C.white}), {spacing:{after:40}}) : spacer(0),
        P(R(at.text,{size:18,color:C.white})),
      ], tone(at.tone || "info").banner));
    }
    kids.push(spacer(120));
  }

  // ----- catalyst / trend narrative -----
  if (cfg.catalyst){
    const cat = cfg.catalyst;
    kids.push(h2(cat.title || "Catalyst / Trend Check"));
    kids.push(twoCol([ cat.left, cat.right ]));
    if (cat.verdict){
      kids.push(spacer(60));
      kids.push(banner([P(R(cat.verdict.text,{bold:true,size:18,color:C.white}))],
        tone(cat.verdict.tone || "navy").banner));
    }
    kids.push(spacer(120));
  }

  // ----- earnings table -----
  if (cfg.earnings){
    const e = cfg.earnings;
    kids.push(h2(e.title || "Latest Earnings Performance"));
    kids.push(dataTable(e.widths || evenWidths(e.headers.length), e.headers, e.rows));
    kids.push(spacer(120));
  }

  // ----- parts (the 3-part rubric) -----
  (cfg.parts||[]).forEach((part,idx)=>{
    kids.push(h2(part.title || `Part ${idx+1}`));
    if (part.question)
      kids.push(P(R(`Question: ${part.question}`,{italics:true,size:19,color:C.gray}), {spacing:{after:80}}));
    if (part.rows && part.rows.length){
      const headers = part.headers || ["Factor","Read"];
      const widths = part.widths || (headers.length===2 ? [2600,6760] : evenWidths(headers.length));
      kids.push(dataTable(widths, headers, part.rows));
    }
    if (part.boxes && part.boxes.length){
      kids.push(spacer(60));
      kids.push(twoCol(part.boxes));
    }
    kids.push(spacer(40));
    kids.push(banner([ P(R(`${(part.scoreLabel||"SCORE")}: ${part.score}`,
      {bold:true,size:21,color:C.white}), {spacing:{before:60,after:60}}) ],
      tone(part.scoreTone).banner));
    kids.push(spacer(120));
  });

  // ----- technicals -----
  if (cfg.technicals){
    const t = cfg.technicals;
    kids.push(h2(t.title || "Technical Analysis"));
    kids.push(dataTable(t.widths || evenWidths(t.headers.length), t.headers, t.rows));
    kids.push(spacer(120));
  }

  // ----- score summary -----
  if (cfg.summary){
    const s = cfg.summary;
    kids.push(h2(s.title || "Framework Score Summary"));
    const rows = (s.rows||[]).slice();
    if (s.total != null)
      rows.push([{t:"TOTAL FRAMEWORK SCORE",bold:true,fill:C.lgray},
                 {t:s.total,bold:true,fill:C.lgray,color:C.navy}]);
    if (s.overlay != null)
      rows.push([{t:"TECHNICAL OVERLAY",bold:true,cellTone:s.overlayTone||"bear"},
                 {t:s.overlay,bold:true,cellTone:s.overlayTone||"bear"}]);
    kids.push(dataTable(s.widths || [5760,3600], s.headers || ["Framework Component","Score"], rows));
    kids.push(spacer(120));
  }

  // ----- final verdict box -----
  if (cfg.finalVerdict){
    const fv = cfg.finalVerdict;
    const lines = [P(R(`VERDICT: ${fv.headline||v.headline||""}`,{bold:true,size:26,color:C.white}),
      {spacing:{after:80}})];
    (fv.lines||[]).forEach(l=>lines.push(
      P([R(`${l.label}: `,{bold:true,size:19,color:C.onOrangeTint}),
         R(l.text,{size:19,color:C.white})], {spacing:{after:40}})));
    if (fv.reasoning)
      lines.push(P(R(`Reasoning: ${fv.reasoning}`,{size:18,color:C.white}), {spacing:{before:60}}));
    kids.push(banner(lines, tone(fv.tone || v.tone).banner));
    kids.push(spacer(140));
  }

  // ----- disclaimer -----
  const disc = cfg.disclaimer ||
    `Not investment advice. This framework analysis is for informational purposes only and reflects publicly reported figures as of ${cfg.date||"the analysis date"}. Figures are drawn from company results and third-party market data and may be revised. Always do your own due diligence.`;
  kids.push(P(R(disc,{italics:true,size:15,color:C.gray})));

  return new Document({
    styles:{default:{document:{run:{font:"Arial",size:20}}}},
    sections:[{
      properties:{page:{size:{width:12240,height:15840},
        margin:{top:1080,right:1440,bottom:1080,left:1440}}},
      footers:{default:new Footer({children:[new Paragraph({alignment:AlignmentType.CENTER,
        children:[ R(`“${philosophy}”   ·   ${cfg.ticker} — ${cfg.company}   ·   Page `,{size:15,color:C.gray}),
          new TextRun({children:[PageNumber.CURRENT], font:"Arial", size:15, color:C.gray}) ]})]})},
      children:kids,
    }]
  });
}

// ================= MAIN =================
(function main(){
  const cfgPath = process.argv[2];
  if (!cfgPath){ console.error("Usage: node generate_report.js <config.json> [output.docx]"); process.exit(1); }
  const cfg = JSON.parse(fs.readFileSync(cfgPath,"utf8"));
  const out = process.argv[3] || `${cfg.ticker}_Momentum_Verification_Analysis.docx`;
  Packer.toBuffer(build(cfg)).then(buf=>{
    fs.writeFileSync(out, buf);
    console.log(`Wrote ${out} (${buf.length} bytes)`);
  }).catch(e=>{ console.error(e); process.exit(1); });
})();
