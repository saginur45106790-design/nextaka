#!/usr/bin/env python3
"""Offline checks. These do not replace npm build, PostgreSQL tests or browser QA."""
from pathlib import Path
import json,re,subprocess,sys
root=Path(__file__).resolve().parents[1]
fail=[]
files=[p for p in root.rglob('*') if p.is_file() and not any(x in p.parts for x in ['node_modules','.git','dist']) and not p.name.endswith('.tsbuildinfo')]
for path in files:
 if path.suffix=='.json':
  try:json.loads(path.read_text())
  except Exception as e:fail.append(f'{path.relative_to(root)}: invalid JSON: {e}')
 if path.suffix not in ['.ts','.tsx','.mjs']:continue
 text=path.read_text()
 for spec in re.findall(r"(?:from\s*|import\s*\()[\'\"](\.[^\'\"]+)[\'\"]",text):
  target=path.parent/spec
  possibilities=[target,Path(str(target)+'.ts'),Path(str(target)+'.tsx'),target/'index.ts']
  if target.suffix=='.js':possibilities += [target.with_suffix('.ts'),target.with_suffix('.tsx')]
  if not any(p.exists() for p in possibilities):fail.append(f'{path.relative_to(root)}: missing import {spec}')
 if path.suffix=='.ts' and not path.name.endswith('.d.ts') and 'backend' in path.parts:
  result=subprocess.run(['node','--experimental-transform-types','--check',str(path)],capture_output=True,text=True)
  if result.returncode:fail.append(f'{path.relative_to(root)}: {result.stderr}')
for forbidden in ['.env','backend/.env','frontend/.env']:
 if (root/forbidden).exists():fail.append(f'{forbidden}: private env file must not be included in archive')
# Execute exact pure money code from sources using Node's TypeScript transform.
script=r"""
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import assert from 'node:assert/strict';
const root=process.argv[1];
const load=async code=>import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(code,{mode:'transform'})).toString('base64'));
const api=readFileSync(root+'/frontend/src/lib/api.ts','utf8');
const display=await load(api.slice(api.indexOf('export function money')));
assert.equal(display.parseMoney('300.25'),'30025');assert.equal(display.parseMoney('0.01'),'1');
for(const v of ['1e3','-3','1.001','abc','Infinity'])assert.throws(()=>display.parseMoney(v));
assert.equal(display.money(undefined),'—');assert.equal(display.money('0'),'৳0');assert.equal(display.money('-100'),'-৳1');
const core=readFileSync(root+'/backend/src/services/core.ts','utf8');
const begin=core.indexOf('export function minor'),end=core.indexOf('export function nonnegativeMinor');
const finance=await load("class AppError extends Error {constructor(s:number,c:string,m:string){super(m);}}\nconst MAX_MINOR=1000000000000n;\n"+core.slice(begin,end));
assert.equal(finance.minor('30000'),30000n);assert.equal(finance.minor('1000000000000'),1000000000000n);
for(const v of ['0','-1','1.5','1e3',' 300','','1000000000001',300])assert.throws(()=>finance.minor(v));
console.log('PASS: 20 exact integer-money and invalid-input assertions');
"""
result=subprocess.run(['node','--input-type=module','-e',script,str(root)],capture_output=True,text=True)
if result.returncode:fail.append(result.stderr)
else:print(result.stdout.strip())
if fail:
 print('\n'.join(fail));sys.exit(1)
print(f'PASS: JSON, local import paths, backend TypeScript syntax, no private env files; {len(files)} source/config/document files.')
print('NOT COVERED: TypeScript typecheck, dependency audit, database migrations/RLS, browser layout, live providers or deployment.')
