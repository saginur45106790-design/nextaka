import { describe,expect,it } from 'vitest';
import {money,parseMoney,date} from '../src/lib/api';
describe('money is integer paisa',()=>{
 it('parses exact decimal amounts',()=>{expect(parseMoney('300.25')).toBe('30025');expect(parseMoney('0.01')).toBe('1');});
 it.each(['1e3','-3','1.001','abc','Infinity'])('rejects %s',v=>expect(()=>parseMoney(v)).toThrow());
 it('never replaces missing balances with invented money',()=>{expect(money(undefined)).toBe('—');expect(money('0')).toBe('৳0');expect(money('-100')).toBe('-৳1');});
 it('uses Bangladesh display time',()=>expect(date('2026-10-22T00:00:00Z')).toContain('06:00'));
});
