import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readRelease} from '../lib/release-manifest.mjs';
test('foreign release records cannot become Shellkite releases',()=>{
 const dir=mkdtempSync(join(tmpdir(),'sk-release-')),file=join(dir,'record.json');
 try{
  const record={channel:'public',build:14,version:'0.2.0',revision:'abc',published:true};
  writeFileSync(file,JSON.stringify(record));assert.throws(()=>readRelease(file),/product/i);
  writeFileSync(file,JSON.stringify({...record,product:'xpromptvs'}));assert.throws(()=>readRelease(file),/product/i);
  writeFileSync(file,JSON.stringify({...record,product:'shellkite'}));assert.equal(readRelease(file).product,'shellkite');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
