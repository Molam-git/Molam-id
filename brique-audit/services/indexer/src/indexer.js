// indexer.js - simple poller that pushes new audit_events to OpenSearch index
import dotenv from 'dotenv';
dotenv.config();
import pool from './db.js';
import { Client } from '@opensearch-project/opensearch';

const client = new Client({ node: process.env.OPENSEARCH_NODE || 'http://opensearch:9200' });

async function indexLoop(){
  while(true){
    const pg = await pool.connect();
    try {
      const { rows } = await pg.query(`SELECT * FROM audit_events WHERE created_at > now() - interval '1 minute' ORDER BY created_at`);
      for(const r of rows){
        const idxName = `molam-audit-${new Date(r.event_time).toISOString().slice(0,10).replace(/-/g,'.')}`;
        await client.index({
          index: idxName,
          id: r.id,
          body: {
            event_time: r.event_time,
            event_type: r.event_type,
            actor_id: r.actor_id,
            actor_role: r.actor_role,
            module: r.module,
            payload: r.payload,
            record_hash: r.record_hash,
            s3_object_key: r.s3_object_key
          }
        });
      }
      // flush
      await client.indices.refresh({ index: '_all' });
    } catch(e) {
      console.error('indexer err', e);
    } finally {
      pg.release();
    }
    await new Promise(r=>setTimeout(r, Number(process.env.INDEX_INTERVAL_MS || 30000)));
  }
}

indexLoop().catch(err=>{ console.error(err); process.exit(1); });
