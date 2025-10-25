// merkle.js - simple binary merkle tree over Buffer[] -> root Buffer
import crypto from 'crypto';

export function merkleRoot(buffers) {
  if(buffers.length===0) return Buffer.from([]);
  let level = buffers.map(b=>Buffer.from(b));
  while(level.length>1) {
    const next = [];
    for(let i=0;i<level.length;i+=2) {
      if(i+1<level.length) {
        next.push(hashConcat(level[i], level[i+1]));
      } else {
        // duplicate last node (or hash with zero) - use duplicate for simplicity
        next.push(hashConcat(level[i], level[i]));
      }
    }
    level = next;
  }
  return level[0];
}

function hashConcat(a,b) {
  return crypto.createHash('sha256').update(Buffer.concat([a,b])).digest();
}
