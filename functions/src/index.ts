import { setGlobalOptions } from 'firebase-functions/v2';

setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

export { mcp } from './mcp/server';
export { chat } from './chat/handler';
