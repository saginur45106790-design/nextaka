import {writeFileSync} from 'node:fs';
const origin=new URL(process.env.SITE_URL||'');
if(origin.protocol!=='https:')throw new Error('SITE_URL must be your actual HTTPS frontend URL.');
const routes=['/','/help','/legal/terms','/legal/privacy','/legal/risk','/legal/refund'];
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const xml='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+routes.map(path=>`<url><loc>${escape(new URL(path,origin.origin).href)}</loc></url>`).join('')+'</urlset>\n';
writeFileSync(new URL('../frontend/public/sitemap.xml',import.meta.url),xml);
console.log('Generated sitemap for the configured production origin.');
