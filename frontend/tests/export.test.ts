import {describe,expect,it} from 'vitest';
import {sanitizedReport} from '../src/lib/export';
describe('permitted report export',()=>{
 it('removes sensitive values recursively while retaining records',()=>{
  expect(sanitizedReport([{id:'visible',passwordHash:'private',nested:{csrfHash:'private',amountMinor:'30000'},tokens:[{tokenHash:'private',status:'ACTIVE'}]}])).toEqual([{id:'visible',nested:{amountMinor:'30000'},tokens:[{status:'ACTIVE'}]}]);
 });
});
