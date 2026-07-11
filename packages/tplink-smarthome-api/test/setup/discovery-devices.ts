import type { Client, AnyDevice } from '../../src';

export default async function getDiscoveryDevices(
  client: Client,
  discoveryTimeout: number,
  discoveryMacAllow: string[],
): Promise<AnyDevice[]> {
  return new Promise((resolve) => {
    const discoveredTestDevices: AnyDevice[] = [];

    client.startDiscovery({
      discoveryTimeout,
      macAddresses: discoveryMacAllow,
    });

    setTimeout(() => {
      client.stopDiscovery();

      for (const device of client.devices.values()) {
        discoveredTestDevices.push(device);
      }
      resolve(discoveredTestDevices);
    }, discoveryTimeout);
  });
}
