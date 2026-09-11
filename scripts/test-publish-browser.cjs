"use strict";
const fs=require("node:fs"),path=require("node:path"),http=require("node:http"),assert=require("node:assert/strict");
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||"playwright"),policy=require("../review/request-policy.js");
const root=path.resolve(__dirname,".."),manifest=JSON.parse(fs.readFileSync(path.join(root,"review/posts.json"),"utf8"));
const out=process.env.QA_OUTPUT?path.resolve(process.env.QA_OUTPUT):path.join(root,"output/playwright");fs.mkdirSync(out,{recursive:true});
const mime={".html":"text/html; charset=utf-8",".css":"text/css",".js":"application/javascript",".json":"application/json",".jpg":"image/jpeg",".png":"image/png"};
const server=http.createServer((req,res)=>{let pathname=decodeURIComponent(new URL(req.url,"http://localhost").pathname).replace(/^\/stationery(?=\/)/,"");
let f=path.resolve(root,"."+pathname);if(f!==root&&!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,"index.html");if(!fs.existsSync(f)){res.writeHead(404).end();return;}res.writeHead(200,{"Content-Type":mime[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(res);});
const fakePull=p=>({number:p.pr,state:"open",draft:false,head:{sha:p.sha,repo:{full_name:policy.repo}},base:{ref:"main",repo:{full_name:policy.repo}}});
const p=manifest.posts[0],fakeIssue={number:999999,state:"open",created_at:"2026-09-11T00:00:00Z",updated_at:"2026-09-11T00:00:00Z",repository_url:"https://api.github.com/repos/"+policy.repo,user:{id:policy.owner.id,login:policy.owner.login,type:"User"},body:policy.requestBody(p)};
(async()=>{await new Promise(r=>server.listen(0,"127.0.0.1",r));const base="http://127.0.0.1:"+server.address().port,browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const results=[];try{
 const context=await browser.newContext({viewport:{width:375,height:900},reducedMotion:"reduce"});
 let mode="ready",capturedURL=null;
 await context.route("https://api.github.com/**",async route=>{
   if(mode==="offline")return route.abort("internetdisconnected");
   if(mode==="error")return route.fulfill({status:403,contentType:"application/json",body:"{}"});
   if(mode==="slow")await new Promise(r=>setTimeout(r,700));
   const u=new URL(route.request().url());
   let data;
   if(u.pathname.endsWith("/issues"))data=mode==="stored"?[fakeIssue]:mode==="spoof"?[{...fakeIssue,user:{...fakeIssue.user,id:123}}]:mode==="edited"?[{...fakeIssue,updated_at:"2026-09-11T00:00:01Z"}]:mode==="cancelled"?[{...fakeIssue,state:"closed"}]:[];
   else {const target=manifest.posts.find(p=>u.pathname.endsWith("/pulls/"+p.pr));data=fakePull(target);if(mode==="stale"&&target.pr===p.pr)data.head.sha="b".repeat(40);if(mode==="merged"&&target.pr===p.pr){data.state="closed";data.merged_at="2026-09-11";}}
   await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(data)});
 });
 await context.route("https://github.com/**",route=>{capturedURL=route.request().url();return route.fulfill({status:200,contentType:"text/html",body:"<!doctype html><title>GitHub handoff test</title><p>Test destination, no submission.</p>"});});
 const page=await context.newPage(),errors=[];page.on("pageerror",e=>errors.push(e.message));
 const first=()=>page.locator('.publish-request[data-pr="'+p.pr+'"]');
 async function loaded(route="/review/"){await page.goto(base+route);await first().waitFor();await page.waitForFunction(()=>document.querySelector(".publish-request")&&!document.querySelector('.publish-request[aria-busy="true"]'));}
 async function fits(){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 mode="slow";await page.goto(base+"/review/");await first().waitFor();assert.equal(await first().locator(".publish-request__action").getAttribute("aria-disabled"),"true");await page.waitForFunction(()=>!document.querySelector('.publish-request[aria-busy="true"]'));results.push("loading / disabled");
 mode="ready";await loaded();assert.equal(await page.locator(".publish-request").count(),4);assert(await first().locator(".publish-request__action").getAttribute("href"));await fits();
 await first().scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,"publish-list-375.png")});
 const dims=await first().locator(".publish-request__action").boundingBox();assert(dims.height>=44);
 await first().locator(".publish-request__action").focus();assert(await first().locator(".publish-request__action").evaluate(el=>document.activeElement===el));
 await Promise.all([page.waitForURL("https://github.com/**"),page.keyboard.press("Enter")]);assert(capturedURL);const handoff=new URL(capturedURL);assert.equal(handoff.searchParams.get("body"),policy.requestBody(p));assert.equal(handoff.pathname,"/"+policy.repo+"/issues/new");results.push("keyboard / correctly prefilled GitHub handoff (mock)");
 mode="stored";await loaded();assert((await first().locator(".publish-request__status").textContent()).includes("저장"));assert((await first().locator(".publish-request__action").getAttribute("href")).endsWith("/issues/999999"));results.push("stored owner request");
 for(const scenario of ["spoof","edited","cancelled"]){mode=scenario;await loaded();assert((await first().locator(".publish-request__action").getAttribute("href")).includes("/issues/new"));results.push(scenario+" ignored");}
 for(const scenario of ["stale","merged"]){mode=scenario;await loaded();assert.equal(await first().locator(".publish-request__action").getAttribute("aria-disabled"),"true");results.push(scenario+" disabled");}
 mode="error";await loaded();assert.equal(await first().locator(".publish-request__action").getAttribute("aria-disabled"),"true");assert((await first().locator(".publish-request__status").textContent()).includes("한도"));await first().scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,"publish-error-375.png")});mode="ready";await first().getByRole("button",{name:"상태 확인",exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.publish-request[aria-busy="true"]'));assert(await first().locator(".publish-request__action").getAttribute("href"));results.push("rate-limit / retry");
 mode="offline";await context.setOffline(true);await first().getByRole("button",{name:"상태 확인",exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.publish-request[aria-busy="true"]'));assert.equal(await first().locator(".publish-request__action").getAttribute("aria-disabled"),"true");mode="ready";await context.setOffline(false);await first().getByRole("button",{name:"상태 확인",exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.publish-request[aria-busy="true"]'));results.push("offline / recovery");
 await loaded("/stationery/story/"+p.url);assert.equal(await page.locator(".publish-request").count(),1);await first().scrollIntoViewIfNeeded();await fits();await page.screenshot({path:path.join(out,"publish-article-375.png")});results.push("article shared control");
 await first().getByRole("link",{name:"요청·취소 방법"}).click();assert(new URL(page.url()).pathname==="/review/request-help.html");await fits();results.push("help / cancel instructions");
 await loaded();await page.setViewportSize({width:1440,height:900});await fits();await page.screenshot({path:path.join(out,"publish-list-1440.png")});
 await page.setViewportSize({width:375,height:900});await page.evaluate(()=>document.documentElement.style.fontSize="200%");await fits();results.push("desktop / 200% text");
 await context.route("**/review/posts.json",route=>route.fulfill({status:200,contentType:"application/json",body:'{"posts":[]}'}));
 await page.goto(base+"/review/");await page.waitForFunction(()=>document.querySelector("[data-request-init]").textContent.includes("현재 발행 요청할 글이 없습니다"));assert.equal(await page.locator(".publish-request").count(),0);results.push("empty request list");
 await context.unroute("**/review/posts.json");
 await context.route("**/review/request-policy.js",route=>route.abort());
 await page.goto(base+"/stationery/story/"+p.url);await page.getByText("발행 요청 기능을 불러오지 못했습니다. 검토함에서 다시 시도해 주세요.",{exact:true}).waitFor();results.push("article script load failure");
 await context.close();
 // Read-only live GitHub API smoke test: no login, no issue submission, no deployed URL access.
 const live=await browser.newContext({viewport:{width:375,height:900},reducedMotion:"reduce"}),lp=await live.newPage();
 await lp.goto(base+"/review/");await lp.locator(".publish-request").first().waitFor();await lp.waitForFunction(()=>!document.querySelector('.publish-request[aria-busy="true"]'));
 const liveStatuses=await lp.locator(".publish-request__status").allTextContents();
 assert(liveStatuses.every(s=>s.includes("요청할 수 있습니다")||s.includes("저장됐습니다")),JSON.stringify(liveStatuses));results.push("live GitHub API GET / 4 current PRs");
 await live.close();assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,checks:results,liveStatuses},null,2));
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exit(1);});
