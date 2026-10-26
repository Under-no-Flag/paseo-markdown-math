import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NATIVE_PAGE_HEIGHT,pageStarts} from '../shared/pagination';

test('short and exact-page documents need one page',()=>{
  assert.deepEqual(pageStarts(900,[0,100,500]),[0]);
  assert.deepEqual(pageStarts(NATIVE_PAGE_HEIGHT,[2000]),[0]);
});
test('prefer block boundaries without omitting content or exceeding the pixel budget',()=>{
  const starts=pageStarts(10000,[0,2500,2700,5100,7900,9999]);
  assert.deepEqual(starts,[0,2700,5100,7900]);
  const ends=[...starts.slice(1),10000];
  assert.equal(ends.reduce((sum,end,i)=>sum+end-starts[i],0),10000);
  assert.ok(ends.every((end,i)=>end-starts[i]<=NATIVE_PAGE_HEIGHT));
});
test('oversized blocks and unordered duplicate boundaries still make bounded progress',()=>{
  assert.deepEqual(pageStarts(9001,[]),[0,3000,6000,9000]);
  assert.deepEqual(pageStarts(8000,[5000,2500,2500,-100,50000]),[0,2500,5000]);
});
