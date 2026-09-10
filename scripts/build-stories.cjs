"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const BASE = "https://minigo.onthemol.com/stationery/";
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const json = value => JSON.stringify(value).replace(/</g, "\\u003c");
const hash = value => crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
const dateText = value => value.replaceAll("-", ". ") + ".";
function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value + "T00:00:00Z").toISOString().slice(0,10) === value;
}
function paragraphs(body) {
  return body.replace(/\r\n/g,"\n").trim().split(/\n\s*\n/).map(block => {
    const lines = block.split("\n");
    if (lines.every(l => l.startsWith("- "))) return "<ul>" + lines.map(l => "<li>" + esc(l.slice(2)) + "</li>").join("") + "</ul>";
    return lines.map(l => l.startsWith("## ") ? "<h2>" + esc(l.slice(3)) + "</h2>" : "<p>" + esc(l) + "</p>").join("\n");
  }).join("\n");
}
function normalize(input) {
  if (!Array.isArray(input)) throw Error("posts.json must contain an array");
  const ids = new Set(), urls = new Set();
  return input.map(p => {
    for (const k of ["id","title","body","date","summary"]) if (typeof p[k] !== "string" || !p[k].trim()) throw Error("Missing post field: " + k);
    if (!validDate(p.date) || (p.updated && !validDate(p.updated))) throw Error("Invalid date: " + p.id);
    if (p.updated && p.updated < p.date) throw Error("Updated date precedes publication");
    const url = p.url || "post-" + hash(p.id) + ".html";
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.html$/.test(url) || ["index.html","post.html","admin.html"].includes(url)) throw Error("Unsafe/reserved article URL");
    if (ids.has(p.id) || urls.has(url)) throw Error("Duplicate post id/URL");
    ids.add(p.id); urls.add(url);
    for (const s of p.sources || []) if (!s.title || !/^https?:\/\//.test(s.url)) throw Error("Invalid source URL");
    for (const f of p.faq || []) if (!f.q || !f.a) throw Error("Incomplete FAQ");
    if (p.image && (!/^\.\.\/assets\/[a-zA-Z0-9._/-]+$/.test(p.image.src) || p.image.src.slice(10).includes("..") || typeof p.image.alt !== "string")) throw Error("Invalid image");
    return {...p, url, description:p.description || p.summary, author:p.author || "미니고 · 브랜드 운영자", tags:p.tags || [], faq:p.faq || [], sources:p.sources || []};
  }).sort((a,b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}
function build(root, options = {}) {
  root = path.resolve(root);
  const read = file => fs.readFileSync(path.join(root,file),"utf8");
  const posts = normalize(options.posts ?? JSON.parse(read("story/posts.json")));
  const output = new Map();
  const put = (file, data) => output.set(file, data);
  // Use only the shared chrome from this template; never its editorial text.
  const template = read("story/pencil-grip-comparison.html");
  const chrome = template.match(/<body[^>]*>([\s\S]*?)<main /)[1];
  const footer = template.slice(template.indexOf('<footer class="site-footer">'));
  const assetNames = new Set();
  function assets(dir) {
    for (const d of fs.readdirSync(path.join(root,dir),{withFileTypes:true})) {
      const name = dir + "/" + d.name;
      if (d.isSymbolicLink()) throw Error("Symlink assets not allowed");
      if (d.isDirectory()) assets(name);
      else if (/\.(jpg|jpeg|png|webp|svg|gif|mp4|woff2?)$/i.test(name)) { assetNames.add(name); put(name,fs.readFileSync(path.join(root,name))); }
    }
  }
  assets("assets");
  for (const file of ["styles.css","script.js","about.html","robots.txt","story/blog.css","story/admin.html","story/post.html"]) put(file,read(file));
  posts.forEach((p,i) => {
    const url = BASE + "story/" + p.url;
    const oldPath = path.join(root,"story",p.url);
    const old = fs.existsSync(oldPath) ? fs.readFileSync(oldPath,"utf8") : "";
    // Preserve existing product figures, not old paragraphs/FAQ.
    let figure = old.match(/<figure\b[\s\S]*?<\/figure>/)?.[0] || "";
    if (p.image) figure = '<figure><img src="' + esc(p.image.src) + '" alt="' + esc(p.image.alt) + '"' + (p.image.width ? ' width="'+Number(p.image.width)+'"' : "") + (p.image.height ? ' height="'+Number(p.image.height)+'"' : "") + '>' + (p.image.caption ? "<figcaption>"+esc(p.image.caption)+"</figcaption>" : "") + "</figure>";
    const imgSrc = figure.match(/src="([^"]+)"/)?.[1];
    const imageURL = imgSrc ? new URL(imgSrc, url).href : null;
    if (imgSrc && !assetNames.has(path.posix.normalize("story/" + imgSrc))) throw Error("Missing image: " + imgSrc);
    const schemas = [
      {"@context":"https://schema.org","@type":"BlogPosting",headline:p.title,description:p.description,datePublished:p.date,dateModified:p.updated || p.date,author:{"@type":"Person",name:p.author},mainEntityOfPage:url,...(imageURL ? {image:imageURL}:{}),keywords:p.tags.join(", ")},
      ...(p.faq.length ? [{"@context":"https://schema.org","@type":"FAQPage",mainEntity:p.faq.map(f=>({"@type":"Question",name:f.q,acceptedAnswer:{"@type":"Answer",text:f.a}}))}] : []),
      {"@context":"https://schema.org","@type":"BreadcrumbList",itemListElement:[["홈",BASE],["이야기",BASE+"story/"],[p.title,url]].map(([name,item],n)=>({"@type":"ListItem",position:n+1,name,item}))}
    ];
    const body = paragraphs(p.body).replace("</p>", "</p>\n" + figure);
    const related = posts.filter(x=>x.id!==p.id).slice(0,2);
    const html = '<!doctype html>\n<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>'+esc(p.title)+' | 미니고</title><meta name="description" content="'+esc(p.description)+'"><meta name="author" content="'+esc(p.author)+'"><link rel="canonical" href="'+esc(url)+'">' +
      '<meta property="og:type" content="article"><meta property="og:locale" content="ko_KR"><meta property="og:title" content="'+esc(p.title)+'"><meta property="og:description" content="'+esc(p.description)+'"><meta property="og:url" content="'+esc(url)+'">' +
      (imageURL ? '<meta property="og:image" content="'+esc(imageURL)+'">' : "") +
      '<link rel="stylesheet" href="../styles.css"><link rel="stylesheet" href="blog.css"><script src="../script.js" defer></script>' +
      schemas.map(s=>'<script type="application/ld+json">'+json(s)+'</script>').join("\n") +
      '</head><body class="story-page post-page">'+chrome+'<main class="post-shell" id="main"><a class="post-back" href="index.html">← 이야기 목록</a><article class="post-article"><header class="post-head"><time datetime="'+p.date+'">'+dateText(p.date)+'</time><h1>'+esc(p.title)+'</h1><p class="post-meta">'+esc(p.author)+(p.updated ? ' · 수정 '+esc(dateText(p.updated)):"")+'</p><div class="blog-tags">'+p.tags.map(t=>'<span class="blog-tag">'+esc(t)+'</span>').join("")+'</div></header><hr class="post-rule"><div class="post-body">'+body+'<p><a class="arrow-link" href="../index.html#products">홈페이지에서 제품 구성 살펴보기</a></p></div>' +
      (p.faq.length ? '<section class="post-faq" aria-labelledby="faq-title"><h2 id="faq-title">자주 묻는 질문</h2>'+p.faq.map(f=>'<details><summary>'+esc(f.q)+'</summary><p>'+esc(f.a)+'</p></details>').join("")+'</section>':"") +
      (p.sources.length ? '<section class="post-sources" aria-labelledby="sources-title"><h2 id="sources-title">참고·출처</h2><ol>'+p.sources.map(s=>'<li><a href="'+esc(s.url)+'" target="_blank" rel="noopener">'+esc(s.title)+'</a></li>').join("")+'</ol></section>':"") +
      '<nav class="post-neighbors" aria-label="함께 읽을 이야기">'+related.map((r,n)=>'<a class="'+(n?"next":"previous")+'" href="'+r.url+'"><span class="post-neighbor-label">함께 읽기</span><strong>'+esc(r.title)+'</strong></a>').join("")+'</nav><a class="post-cta" href="https://smartstore.naver.com/living523" target="_blank" rel="noopener">미니고 스마트스토어에서 연필교정기 보기 ↗</a></article></main>'+footer;
    put("story/"+p.url,html);
  });
  const tags = p => '<div class="blog-tags">'+p.tags.map(t=>'<span class="blog-tag">'+esc(t)+'</span>').join("")+'</div>';
  const cards = posts.map((p,i)=>'<li class="blog-card"><a href="'+p.url+'"><span class="blog-card-number" aria-hidden="true">'+String(i+1).padStart(2,"0")+'</span><div class="blog-card-content"><time datetime="'+p.date+'">'+dateText(p.date)+'</time><h3>'+esc(p.title)+'</h3><p class="blog-card-summary">'+esc(p.summary)+'</p>'+tags(p)+'</div><span class="blog-card-arrow" aria-hidden="true">↗</span></a></li>').join("\n");
  const home = posts.slice(0,3).map(p=>'<article class="story-item"><a href="story/'+p.url+'"><time datetime="'+p.date+'">'+dateText(p.date)+'</time><h3>'+esc(p.title)+'</h3><p>'+esc(p.summary)+'</p><span aria-hidden="true">↗</span></a></article>').join("\n");
  function replaceList(file, pattern, content) {
    const original=read(file);
    if (!pattern.test(original)) throw Error("Missing list placeholder: "+file);
    put(file,original.replace(pattern,(_,start,end)=>start+content+end));
  }
  replaceList("story/index.html",/(<ol class="blog-list"[^>]*>)[\s\S]*?(<\/ol>)/,cards || '<li>아직 발행된 이야기가 없습니다.</li>');
  replaceList("index.html",/(<div class="story-list"[^>]*>)[\s\S]*?(<\/div>)/,home || '<p>첫 번째 이야기를 준비하고 있습니다.</p>');
  put("story/posts.json",JSON.stringify(posts,null,2)+"\n");
  const sitePages = [BASE,BASE+"about.html",BASE+"story/"];
  put("sitemap.xml",'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+sitePages.map(u=>'<url><loc>'+esc(u)+'</loc></url>').join("")+posts.map(p=>'<url><loc>'+BASE+'story/'+p.url+'</loc><lastmod>'+(p.updated||p.date)+'</lastmod></url>').join("")+'</urlset>\n');
  put("feed.xml",'<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>미니고 이야기</title><link>'+BASE+'story/</link><description>미니고의 제품과 사용 이야기</description><language>ko-KR</language><atom:link href="'+BASE+'feed.xml" rel="self" type="application/rss+xml"/>'+posts.slice(0,20).map(p=>'<item><title>'+esc(p.title)+'</title><link>'+BASE+'story/'+p.url+'</link><description>'+esc(p.summary)+'</description><pubDate>'+new Date(p.date+"T00:00:00+09:00").toUTCString()+'</pubDate><guid isPermaLink="true">'+BASE+'story/'+p.url+'</guid></item>').join("")+'</channel></rss>\n');
  const llmsHead=read("llms.txt").split("## 이야기(블로그)")[0];
  put("llms.txt",llmsHead+"## 이야기(블로그)\n\n"+posts.slice(0,30).map(p=>"- ["+p.title.replace(/[\r\n[\]]/g," ")+"]("+BASE+"story/"+p.url+"): "+p.summary.replace(/[\r\n]/g," ")).join("\n")+"\n");
  // Preview pages are never indexed, including when this generator is used in a PR.
  if (process.env.VERCEL_ENV === "preview" || options.preview) {
    for(const [file,data] of output) if(file.endsWith(".html")) put(file,String(data).replace(/<head>/i,'<head><meta name="robots" content="noindex,nofollow">'));
  }
  if(options.write === false) return {posts,output};
  const out=path.join(root,"_site");
  if(path.dirname(out)!==root || path.basename(out)!=="_site") throw Error("Unsafe output path");
  if(fs.existsSync(out)) {
    if(fs.lstatSync(out).isSymbolicLink() || !fs.existsSync(path.join(out,".generated-by-story-sync"))) throw Error("Refusing to overwrite unowned output");
    fs.rmSync(out,{recursive:true});
  }
  fs.mkdirSync(out);
  fs.writeFileSync(path.join(out,".generated-by-story-sync"),"generated\n");
  for(const [name,data] of output) {const file=path.join(out,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,data);}
  console.log("Generated "+posts.length+" static stories into _site");
  return {posts,output};
}
module.exports={build,normalize,paragraphs};
if(require.main===module) build(path.join(__dirname,".."));

