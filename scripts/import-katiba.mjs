import fs from 'node:fs';import path from 'node:path';
const source=process.argv[2]||'katiba file';const out='public/katiba-data';
if(!fs.existsSync(source)){console.error('Source folder not found:',source);process.exit(1)}
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const files=walk(source).filter(f=>f.endsWith('.json'));const articles=[],chapters=[],appendices=[],raw=[];
for(const file of files){const rel=path.relative(source,file).replaceAll('\\','/');const x=JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
 const family=rel.startsWith('Rasimu za Katiba/')?'draft':'official';const jurisdiction=rel.includes('/Zanzibar/')?'zanzibar':'tanzania';
 if(x.ibara!==undefined&&x.maudhui!==undefined){articles.push({id:(x.chanzo?.documentId||jurisdiction)+'-article-'+String(x.ibara).toLowerCase(),documentId:x.chanzo?.documentId||'',family,jurisdiction,number:String(x.ibara),title:x.jina||'',chapter:x.sura||'',part:x.sehemu||'',text:x.maudhui||'',clauses:Array.isArray(x.vifungu)?x.vifungu:[],sourceLocator:x.chanzo?.sourceLocator||'',verificationStatus:x.chanzo?.verificationStatus||'pending',sourceFile:rel})}
 else if(x.chapterNumber!==undefined){chapters.push({documentId:x.documentId||'',family,jurisdiction,number:x.chapterNumber,title:x.jina||'',chapter:x.sura||'',parts:x.sehemu||[],articleFiles:x.ibara||[],sourceFile:rel})}
 else if(x.nyongeza){appendices.push({...x,family,jurisdiction,sourceFile:rel})}
 raw.push({path:rel,type:x.ibara!==undefined&&x.maudhui!==undefined?'article':x.chapterNumber!==undefined?'chapter':x.nyongeza?'appendix':'other'});}
articles.sort((a,b)=>a.documentId.localeCompare(b.documentId)||a.number.localeCompare(b.number,undefined,{numeric:true}));chapters.sort((a,b)=>a.documentId.localeCompare(b.documentId)||Number(a.number)-Number(b.number));
fs.mkdirSync(out,{recursive:true});
const docs=[{id:'doc-union-1977',title:'Katiba ya Jamhuri ya Muungano wa Tanzania',family:'official',jurisdiction:'tanzania'},{id:'doc-zanzibar-1984',title:'Katiba ya Zanzibar',family:'official',jurisdiction:'zanzibar'},{id:'doc-rasimu-tanzania-2014',title:'Rasimu ya Katiba ya Tanzania',family:'draft',jurisdiction:'tanzania'}].map(d=>({...d,articleCount:articles.filter(a=>a.documentId===d.id).length,chapterCount:chapters.filter(c=>c.documentId===d.id).length}));
const write=(n,v)=>fs.writeFileSync(path.join(out,n),JSON.stringify(v,null,2));
write('documents.json',docs);write('articles.json',articles);write('chapters.json',chapters);write('appendices.json',appendices);write('manifest.json',{generatedAt:new Date().toISOString(),sourceFolder:source,fileCount:files.length,articleCount:articles.length,chapterCount:chapters.length,appendixCount:appendices.length,documents:docs,files:raw});
console.log({files:files.length,articles:articles.length,chapters:chapters.length,appendices:appendices.length,documents:docs});