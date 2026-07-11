import { use, expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';
import dgram from 'dgram';
import net from 'net';

import * as config from './config';

use(chaiAsPromised);
use(sinonChai);

export { expect };

export {
  getTestClient,
  testDevices,
  testDeviceCleanup,
} from './test-device-setup';

export { config };

export function retry(
  fn: () => Promise<unknown>,
  retries = 3,
): Promise<unknown> {
  return fn().catch((e) =>
    retries <= 0 ? Promise.reject(e as Error) : retry(fn, retries - 1),
  );
}

export async function createUnresponsiveDevice(
  transport: 'tcp' | 'udp',
): Promise<{ port: number; host: string; close: () => void }> {
  return new Promise((resolve, reject) => {
    let port: number;
    let host: string;
    let close: () => void;

    if (transport === 'tcp') {
      const server = net.createServer();
      close = function (): void {
        server.close();
      };

      server.listen(0, () => {
        const address = server.address();
        if (
          address === null ||
          typeof address === 'string' ||
          !('port' in address)
        ) {
          reject(new Error('Could not determine server address'));
          return;
        }
        port = address.port;
        host = address.address;
        resolve({ port, host, close });
      });
    } else {
      const server = dgram.createSocket('udp4');
      close = function (): void {
        server.close();
      };

      server.bind(0, () => {
        const address = server.address();
        port = address.port;
        host = address.address;
        resolve({ port, host, close });
      });
    }
  });
}
