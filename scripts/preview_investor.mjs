// Local managed-preview adapter. This script is not a production function.
// Production credentials have no defaults and live only in Netlify.
import http from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import path from 'node:path';
import {randomBytes,pbkdf2Sync} from 'node:crypto';
import portal from '../netlify/functions/investor-portal.mjs';
import login from '../netlify/functions/investor-login.mjs';

const root=process.cwd(), published=path.join(root,'dist');
const salt=randomBytes(18);
// Isolated, non-production test fixture; never used by the production bundle.
process.env.SIH_VIP_USERNAME='preview-reviewer';
process.env.SIH_VIP_PASSWORD_HASH='pbkdf2-sha256$600000$'+salt.toString('base64url')+'$'+pbkdf2Sync('preview-only-test',salt,600000,32,'sha256').toString('base64url');
process.env.SIH_VIP_SESSION_SECRET=randomBytes(32).toString('base64url');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.txt':'text/plain','.xml':'application/xml'};
const server=http.createServer(async(req,res)=>{
  try {
    const origin='https://'+req.headers.host, url=new URL(req.url,origin);
    if(url.pathname.startsWith('/partners/investors')||url.pathname.startsWith('/.netlify/functions/investor-')){
      const chunks=[];let size=0;
      for await(const chunk of req){size+=chunk.length;if(size>8192){res.writeHead(413);res.end('Too large');return;}chunks.push(chunk);}
      const request=new Request(url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})});
      const response=await(url.pathname==='/partners/investors/login'?login:portal)(request,{});
      res.writeHead(response.status,Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));return;
    }
    let file=path.resolve(published,'.'+decodeURIComponent(url.pathname));
    if(file!==published&&!file.startsWith(published+path.sep)){res.writeHead(404);res.end();return;}
    try{if((await stat(file)).isDirectory())file=path.join(file,'index.html');}
    catch{if(!path.extname(file))file=path.join(file,'index.html');}
    let body,status=200;
    try{body=await readFile(file);}catch{file=path.join(published,'404.html');body=await readFile(file);status=404;}
    res.writeHead(status,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
    res.end(req.method==='HEAD'?undefined:body);
  }catch(error){res.writeHead(500,{'Content-Type':'text/plain'});res.end('Preview request failed.');console.error(error.message);}
});
const portArgument=process.argv.indexOf('--port');
const previewPort=portArgument>=0?Number(process.argv[portArgument+1]):Number(process.env.PORT||3000);
server.listen(previewPort,'0.0.0.0',()=>console.log('Investor preview ready.'));
