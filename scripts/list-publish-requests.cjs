"use strict";
const fs=require("node:fs"),path=require("node:path");
const policy=require("../review/request-policy.js");
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,"../review/posts.json"),"utf8"));
async function get(route) {
  const headers={Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"};
  if(process.env.GITHUB_TOKEN) headers.Authorization="Bearer "+process.env.GITHUB_TOKEN;
  const response=await fetch("https://api.github.com/repos/"+policy.repo+route,{headers,signal:AbortSignal.timeout(15000)});
  if(!response.ok) throw new Error("GitHub 조회 실패: "+response.status);
  return response.json();
}
(async()=>{
  const issues=[];
  let complete=false;
  for(let page=1;page<=10;page++){
    const batch=await get("/issues?creator="+policy.owner.login+"&state=all&per_page=100&page="+page);
    if(!Array.isArray(batch))throw new Error("Invalid response");
    issues.push(...batch);
    if(batch.length<100){complete=true;break;}
  }
  if(!complete)throw new Error("조회 범위 초과: 일부 결과로 요청을 처리하지 않습니다.");
  const requests=[],states=[];
  for(const post of manifest.posts){
    if(!policy.validPost(post))throw new Error("Invalid manifest");
    const pull=await get("/pulls/"+post.pr),state=policy.pullState(post,pull);
    states.push({pr:post.pr,state});
    const issue=policy.storedRequest(issues,post,pull);
    if(issue)requests.push({key:policy.requestKey(post),issue:issue.number,issueUrl:"https://github.com/"+policy.repo+"/issues/"+issue.number,pr:post.pr,sha:post.sha,url:post.url,title:post.title,authorId:issue.user.id,createdAt:issue.created_at});
  }
  console.log(JSON.stringify({readOnly:true,checkedAt:new Date().toISOString(),requests,states,note:"요청 조회 결과일 뿐 발행 완료나 자동 병합 허가가 아닙니다. 실제 처리 직전에 작성자·기록 변경·종료 상태·PR SHA를 다시 확인하세요."},null,2));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
