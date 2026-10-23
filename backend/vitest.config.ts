import { defineConfig } from 'vitest/config';
export default defineConfig({test:{passWithNoTests:false,projects:[
 {test:{name:'unit',include:['tests/*.unit.test.ts'],environment:'node',pool:'forks',allowOnly:false,restoreMocks:true}},
 {test:{name:'integration',include:['tests/*.integration.test.ts'],setupFiles:['tests/setup.ts'],environment:'node',pool:'forks',fileParallelism:false,maxWorkers:1,testTimeout:30000,hookTimeout:120000,allowOnly:false}}
]}});
