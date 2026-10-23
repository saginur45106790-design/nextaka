import { describe,expect,it } from 'vitest';
import {legalContent} from '../src/content/legal';
describe('truthful public policies',()=>{
 it('contains terms, privacy, risk and refund documents',()=>expect(Object.keys(legalContent).sort()).toEqual(['privacy','refund','risk','terms']));
 it('explicitly distinguishes targets from guarantees',()=>{const text=legalContent.risk.sections.map(s=>s.body[1]).join(' ');expect(text).toContain('Targets may not be met');expect(text).toContain('capital may be lost');});
});
