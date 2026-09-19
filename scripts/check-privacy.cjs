// Local-only audit. Prints locations and finding types, never credential contents.
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const root=path.resolve(__dirname,'..');
const git=(...args)=>execFileSync('git',['-c',`safe.directory=${root.replaceAll('\\','/')}`,...args],{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024});
const privatePath=p=>/(^|\/)(\.env(?:\..*)?|\.npmrc|data|test-results|node_modules|dist[^/]*)(\/|$)|\.(xlsx?|csv|pem|key|pfx|p12|exe|asar|log)$|(^|\/)(credentials|secrets).*\.json$/i.test(p);
const textFile=p=>/\.(?:js|cjs|mjs|json|html|css|md|ya?ml|toml|txt|py|ps1|sh)$|(^|\/)\.gitignore$/.test(p);
const patterns=[
    ['token com prefixo conhecido',/\b(?:sk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{30,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/],
    ['chave privada',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
    ['credencial atribuída em texto',/(?:ai_api_key|brapi_token|OPENAI_API_KEY|apiKey)["']?\s*[:=]\s*["']([A-Za-z0-9_\-]{20,})["']/]
];
const findings=[];
function scan(name,text){for(const [kind,re] of patterns)if(re.test(text))findings.push({location:name,kind});}
const files=[...new Set(git('ls-files','--cached','--others','--exclude-standard','-z').split('\0').filter(Boolean))];
for(const f of files){
    if(!fs.existsSync(path.join(root,f)))continue;
    if(privatePath(f))findings.push({location:f,kind:'arquivo pessoal ou gerado candidato ao Git'});
    if(textFile(f))scan(f,fs.readFileSync(path.join(root,f),'utf8'));
}
// Also inspect the index: a secret staged earlier must not be hidden by a clean working copy.
const blobs=new Set();
for(const entry of git('ls-files','--stage','-z').split('\0').filter(Boolean)){
    const [meta,f]=entry.split('\t');const sha=meta.split(' ')[1];
    if(privatePath(f))findings.push({location:'index:'+f,kind:'arquivo pessoal ou gerado no index'});
    if(textFile(f)&&!blobs.has(sha)){scan('index:'+f,git('cat-file','-p',sha));blobs.add(sha);}
}
let commits=0;
if(process.argv.includes('--history'))for(const rev of git('rev-list','--all').trim().split('\n').filter(Boolean)){
    commits++;
    for(const entry of git('ls-tree','-r','-z',rev).split('\0').filter(Boolean)){
        const [meta,f]=entry.split('\t');const sha=meta.split(' ')[2];
        if(privatePath(f))findings.push({location:rev.slice(0,8)+':'+f,kind:'arquivo pessoal ou gerado no histórico'});
        if(textFile(f)&&!blobs.has(sha)){scan(rev.slice(0,8)+':'+f,git('cat-file','-p',sha));blobs.add(sha);}
    }
}
console.log(JSON.stringify({candidateFiles:files.length,historyCommits:commits,findings},null,2));
if(findings.length)process.exitCode=1;
