// spell-checker:ignore Mock’s
import * as simulator from 'tplink-smarthome-simulator';
import type { AnyDevice, Client, PlugSysinfo } from '../../src';

type SimulatorDevice = {
  start: () => Promise<unknown>;
  stop: () => Promise<unknown>;
  model: string;
  data: { mac: string; system: { sysinfo: { hw_ver: string } } };
  address: string;
  port: number;
  children: Array<{ sysinfo: { id: string } }>;
};

function getConnectableHost(address: string): string {
  return address === '0.0.0.0' ? '127.0.0.1' : address;
}

async function simulatorToDevice(
  client: Client,
  simulatorDevice: SimulatorDevice,
): Promise<AnyDevice> {
  return client.getDevice({
    host: getConnectableHost(simulatorDevice.address),
    port: simulatorDevice.port,
  });
}

export const startUdpServer = () => simulator.UdpServer.start();

export const stopUdpServer = () => {
  simulator.UdpServer.stop();
};

const simulatorDevices: SimulatorDevice[] = [];

export async function getSimulatedUnreliableDevice(
  client: Client,
): Promise<AnyDevice> {
  const device = new simulator.Device({
    model: 'hs100',
    alias: 'Mock Unreliable 100%',
    unreliablePercent: 1,
    data: { mac: 'aa:aa:aa:00:00:99' },
  });

  const sysInfo = device.api.system.get_sysinfo() as PlugSysinfo;

  await device.start();
  simulatorDevices.push(device);
  return client.getPlug({
    sysInfo,
    host: getConnectableHost(device.address),
    port: device.port,
  });
}

export async function cleanUpSimulatedDevices(): Promise<void> {
  const len = simulatorDevices.length;
  for (let i = 0; i < len; i += 1) {
    const sd = simulatorDevices.shift();
    // eslint-disable-next-line no-await-in-loop
    if (sd !== undefined) await sd.stop();
  }
}

async function getSimulatorDevices(): Promise<SimulatorDevice[]> {
  const simulatedDevices: SimulatorDevice[] = [
    new simulator.Device({
      model: 'hs100',
      alias: 'Mock HS100',
      data: { mac: 'aa:aa:aa:00:00:01' },
    }),

    new simulator.Device({
      model: 'hs105',
      alias: 'Mock’s “HS105”',
      data: { mac: 'aa:aa:aa:00:00:02' },
    }),

    new simulator.Device({
      model: 'hs110',
      alias: 'Mock😽 HS110',
      data: { mac: 'aa:aa:aa:00:00:03' },
    }),

    new simulator.Device({
      model: 'hs110v2',
      alias: 'Mock HS110v2',
      data: { mac: 'aa:aa:aa:00:00:04' },
    }),

    new simulator.Device({
      model: 'hs200',
      alias: 'Mock HS200',
      data: { mac: 'aa:aa:aa:00:00:05' },
    }),

    new simulator.Device({
      model: 'hs220',
      alias: 'Mock HS220',
      data: { mac: 'aa:aa:aa:00:00:06' },
    }),

    new simulator.Device({
      model: 'hs300',
      alias: 'Mock HS300',
      data: { mac: 'aa:aa:aa:00:00:07' },
    }),

    new simulator.Device({
      model: 'lb100',
      alias: 'Mock LB100',
      data: { mac: 'aa:aa:aa:00:00:08' },
    }),

    new simulator.Device({
      model: 'lb120',
      alias: 'Mock LB120',
      data: { mac: 'aa:aa:aa:00:00:09' },
    }),

    new simulator.Device({
      model: 'lb130',
      alias: 'Mock LB130',
      data: { mac: 'aa:aa:aa:00:00:10' },
    }),

    new simulator.Device({
      model: 'kl430',
      alias: 'Mock KL430',
      data: { mac: 'aa:aa:aa:00:00:11' },
    }),
  ];

  for (const sd of simulatedDevices) {
    // eslint-disable-next-line no-await-in-loop
    await sd.start();
    simulatorDevices.push(sd);
  }

  return simulatedDevices;
}

export async function getSimulatedDevices(
  client: Client,
): Promise<AnyDevice[]> {
  const devices: AnyDevice[] = [];

  for (const sim of await getSimulatorDevices()) {
    devices.push(
      // eslint-disable-next-line no-await-in-loop
      await simulatorToDevice(client, sim),
    );
  }

  return devices;
}
