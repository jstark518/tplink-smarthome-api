/* eslint-disable no-unused-expressions */

import sinon from 'sinon';
import dgram from 'dgram';
import { EventEmitter } from 'events';
import { encrypt } from '@jstark/tplink-smarthome-crypto';

import { config, expect, getTestClient, testDevices } from './setup';

import type { AnyDevice } from '../src';
import Client from '../src/client';
import type {
  AnyDeviceDiscovery,
  ClientConstructorOptions,
  SendOptions,
} from '../src/client';
import type { Logger } from '../src/logger';
import Device from '../src/device';
import Plug from '../src/plug';
import Bulb from '../src/bulb';

import type { TestDevice } from './setup/test-device';

import { compareMac } from '../src/utils';

const validPlugDiscoveryResponse = {
  system: {
    get_sysinfo: {
      alias: 'test',
      deviceId: 'test',
      model: 'test',
      sw_ver: 'test',
      hw_ver: 'test',
      type: 'plug',
      mac: 'test',
      feature: 'test',
      relay_state: 0,
    },
  },
};

describe('Client', function () {
  describe('constructor', function () {
    it('should use custom logger', function () {
      const debugSpy = sinon.spy();
      const infoSpy = sinon.spy();

      const logger = {
        debug: debugSpy,
        info: infoSpy,
      } as unknown as Logger;

      const client = new Client({ logger });

      client.log.debug('debug msg');
      client.log.info('info msg');

      expect(debugSpy).to.be.calledOnce;
      expect(infoSpy).to.be.calledOnce;
    });
  });

  describe('#startDiscovery()', function () {
    this.retries(1);
    this.timeout(config.defaultTestTimeout * 2);
    this.slow(config.defaultTestTimeout);

    let client: Client;
    beforeEach('startDiscovery', function () {
      client = getTestClient();
    });

    afterEach('startDiscovery', function () {
      client.stopDiscovery();
    });

    it('should emit device-new when finding a new device', function (done) {
      client
        .startDiscovery({ discoveryInterval: 250 })
        .once('device-new', (device) => {
          expect(device).to.be.an.instanceof(Device);
          client.stopDiscovery();
          done();
        });
    });

    it('should emit device-new when finding a new device with `devices` specified', function (done) {
      const { mac } = testDevices.anyDevice;
      const { host } = testDevices.anyDevice.deviceOptions ?? {};
      expect('mac', mac).to.be.a('string').and.not.empty;
      expect('host', host).to.be.a('string').and.not.empty;

      client
        .startDiscovery({
          discoveryInterval: 250,
          devices: [{ host: host as string }],
        })
        .on('device-new', (device) => {
          if (device.mac === mac) {
            client.stopDiscovery();
            done();
          }
        });
    });

    it('should emit device-new when finding a new device with a deviceType filter', function (done) {
      client
        .startDiscovery({ discoveryInterval: 250, deviceTypes: ['plug'] })
        .once('device-new', (device) => {
          expect(device).to.be.an.instanceof(Device);
          client.stopDiscovery();
          done();
        });
    });

    it('should ONLY emit device-new for specified deviceTypes', function (done) {
      client
        .startDiscovery({ discoveryInterval: 250, deviceTypes: ['plug'] })
        .on('device-new', (device) => {
          expect(device.deviceType).to.eql('plug');
        });
      setTimeout(done, 1000);
    });

    it('should NOT emit device-new with an incorrect deviceType filter', function (done) {
      client
        .startDiscovery({
          discoveryInterval: 250,
          deviceTypes: ['invalidDeviceType' as 'plug'],
        })
        .once('device-new', (device) => {
          client.stopDiscovery();
          expect(device).to.not.exist;
        });
      setTimeout(done, 1000);
    });

    it('should ONLY emit device-new for specified macAddresses', function (done) {
      const spy = sinon.spy();
      const { mac } = testDevices.anyDevice;
      expect(mac).to.be.a('string').and.not.empty;

      client
        .startDiscovery({
          discoveryInterval: 250,
          macAddresses: [mac as string],
        })
        .on('device-new', spy);

      setTimeout(() => {
        expect(spy, `MAC:[${mac}] not found`).to.be.called;
        expect(spy).to.always.be.calledWithMatch({ mac });
        done();
      }, 1000);
    });

    it('should NOT emit device-new for specified excludedMacAddresses', function (done) {
      const spy = sinon.spy();
      const { mac } = testDevices.anyDevice;
      expect(mac, 'mac blank').to.be.a('string').and.not.empty;

      client
        .startDiscovery({
          discoveryInterval: 250,
          excludeMacAddresses: [mac as string],
        })
        .on('device-new', spy);

      setTimeout(() => {
        client.stopDiscovery();
        expect(spy).to.be.called;
        expect(spy).to.not.be.calledWithMatch({ mac });
        done();
      }, 1000);
    });

    it('should NOT emit device-new for devices not meeting filterCallback', function (done) {
      const spy = sinon.spy();
      const { mac } = testDevices.anyDevice;
      expect(mac, 'mac blank').to.be.a('string').and.not.empty;

      client
        .startDiscovery({
          discoveryInterval: 250,
          filterCallback: (sysInfo) => {
            return !compareMac((sysInfo as { mac: string }).mac, mac as string);
          },
        })
        .on('device-new', spy);

      setTimeout(() => {
        client.stopDiscovery();
        expect(spy).to.be.called;
        expect(spy).to.not.be.calledWithMatch({ mac });
        done();
      }, 1000);
    });

    it('should NOT emit device-new for devices not meeting filterCallback -- all devices', function (done) {
      const spy = sinon.spy();

      client
        .startDiscovery({ discoveryInterval: 250, filterCallback: () => false })
        .on('device-new', spy);

      setTimeout(() => {
        client.stopDiscovery();
        expect(spy).to.not.be.called;
        done();
      }, 1000);
    });

    it('should emit device-new for devices meeting filterCallback -- all devices', function (done) {
      client
        .startDiscovery({ discoveryInterval: 250, filterCallback: () => true })
        .once('device-new', () => {
          client.stopDiscovery();
          done();
        });
    });

    it('should ignore invalid devices that respond without encryption', function (done) {
      const socket = new EventEmitter() as EventEmitter & {
        bind: sinon.SinonSpy;
        address: () => { address: string; port: number };
        setBroadcast: sinon.SinonSpy;
      };

      const createSocket = function (): typeof socket {
        socket.bind = sinon.fake();
        socket.address = () => ({ address: '1.2.3.4', port: 1234 });
        socket.setBroadcast = sinon.fake();
        return socket;
      };

      sinon.replace(
        dgram,
        'createSocket',
        createSocket as unknown as typeof dgram.createSocket,
      );

      const message = JSON.stringify(validPlugDiscoveryResponse);

      client
        .startDiscovery({ discoveryInterval: 250 })
        .on('device-new', (device) => {
          client.stopDiscovery();
          done(new Error(`Device should have been ignored: ${device.host}`));
        })
        .on('discovery-invalid', ({ rinfo, response }) => {
          expect(rinfo.address).to.eql('1.2.3.5');
          expect(rinfo.port).to.eql(1235);
          expect(response).to.eql(message);
          done();
        });

      socket.emit('message', message, {
        address: '1.2.3.5',
        port: 1235,
      });
    });

    describe('should ignore invalid devices that respond without valid response', function () {
      [
        JSON.stringify(''),
        JSON.stringify('data'),
        JSON.stringify({}),
        JSON.stringify({ unexpected: 'data' }),
        JSON.stringify({ system: undefined }),
        JSON.stringify({ system: {} }),
        JSON.stringify({ system: 'data' }),
        JSON.stringify({ system: { get_sysinfo: undefined } }),
        JSON.stringify({ system: { get_sysinfo: {} } }),
        JSON.stringify({ system: { get_sysinfo: 'data' } }),
        JSON.stringify({ system: { get_sysinfo: { alias: 'test' } } }),
      ].forEach((t) => {
        ['encrypted', 'unencrypted'].forEach((te) => {
          it(`${t} - ${te}`, function (done) {
            const socket = new EventEmitter() as EventEmitter & {
              bind: sinon.SinonSpy;
              address: () => { address: string; port: number };
              setBroadcast: sinon.SinonSpy;
            };

            const createSocket = function (): typeof socket {
              socket.bind = sinon.fake();
              socket.address = () => ({ address: '1.2.3.4', port: 1234 });
              socket.setBroadcast = sinon.fake();
              return socket;
            };

            sinon.replace(
              dgram,
              'createSocket',
              createSocket as unknown as typeof dgram.createSocket,
            );

            let message: string | Buffer;
            if (te === 'encrypted') {
              message = encrypt(t);
            } else {
              message = t;
            }

            client
              .startDiscovery({ discoveryInterval: 250 })
              .on('device-new', (device) => {
                client.stopDiscovery();
                done(
                  new Error(`Device should have been ignored: ${device.host}`),
                );
              })
              .on('discovery-invalid', ({ rinfo, response }) => {
                expect(rinfo.address).to.eql('1.2.3.5');
                expect(rinfo.port).to.eql(1235);
                expect(response).to.eql(message);
                done();
              });

            socket.emit('message', message, {
              address: '1.2.3.5',
              port: 1235,
            });
          });
        });
      });
    });

    const events = ['new', 'online', 'offline'] as const;
    const eventTests: {
      typeName: string;
      type: typeof Device | typeof Plug | typeof Bulb;
      event: (typeof events)[number];
    }[] = [];
    [
      { typeName: 'device', type: Device },
      { typeName: 'plug', type: Plug },
      { typeName: 'bulb', type: Bulb },
    ].forEach((t) => {
      events.forEach((e) => {
        eventTests.push({ ...t, event: e });
      });
    });

    eventTests.forEach((et) => {
      const eventName = `${et.typeName}-${et.event}`;

      it(`should emit ${eventName} when finding a(n) ${et.event} ${et.typeName}`, async function () {
        if (et.event === 'offline') {
          let device;
          switch (et.typeName) {
            case 'device':
              device = testDevices.anyDevice;
              break;
            case 'plug':
              device = testDevices.anyPlug;
              break;
            case 'bulb':
              device = testDevices.anyBulb;
              break;
            default:
              throw new Error(`Unexpected device type:${et.typeName}`);
          }

          if (!('getDevice' in device)) this.skip();

          const invalidDevice = (await client.getDevice(
            device.deviceOptions as NonNullable<TestDevice['deviceOptions']>,
          )) as AnyDeviceDiscovery;
          invalidDevice.host =
            testDevices.unreachable.deviceOptions?.host ?? '';
          invalidDevice.status = 'online';
          invalidDevice.seenOnDiscovery = 0;
          client.devices.set(`${invalidDevice.deviceId}INV`, invalidDevice);
        }

        return new Promise<void>((resolve) => {
          client
            .startDiscovery({ discoveryInterval: 100, offlineTolerance: 2 })
            .once(eventName, (device: Device | Plug | Bulb) => {
              expect(device).to.be.an.instanceof(et.type);
              client.stopDiscovery();
              resolve();
            });
        });
      });
    });

    it('should timeout with timeout set', function (done) {
      this.slow(100);
      client.startDiscovery({ discoveryInterval: 0, discoveryTimeout: 1 });
      setTimeout(() => {
        expect(client.discoveryPacketSequence).to.be.above(0);
        expect(client.discoveryTimer).to.not.exist;
        done();
      }, 50);
    });

    it('should emit discovery-invalid for the unreliable test device', function (done) {
      const device = testDevices.unreliable;
      if (!device.deviceOptions || !device.deviceOptions.port) this.skip();

      client
        .startDiscovery({ discoveryInterval: 250 })
        .on('discovery-invalid', ({ rinfo, response, decryptedResponse }) => {
          expect(response).to.be.instanceof(Buffer);
          expect(decryptedResponse).to.be.instanceof(Buffer);

          if (rinfo.port === device.deviceOptions?.port) {
            client.stopDiscovery();
            done();
          }
        });
    });

    it('should emit device-new for each child for devices with children and breakoutChildren is true', function (done) {
      const devices: Record<string, { children: (string | undefined)[] }> = {};
      client
        .startDiscovery({
          discoveryInterval: 250,
          deviceTypes: ['plug'],
          breakoutChildren: true,
        })
        .on('device-new', (device) => {
          if (/^HS300/.exec(device.model)) {
            const plug = device as Plug;
            expect(plug.children).to.have.property('size', 6);
            expect(plug.sysInfo.children).to.have.lengthOf(plug.children.size);
            let entry = devices[plug.deviceId];
            if (entry == null) {
              entry = { children: [] };
              devices[plug.deviceId] = entry;
            }
            entry.children.push(plug.childId);

            if (entry.children.length >= plug.children.size) {
              entry.children.sort().forEach((childId, i) => {
                expect(childId).to.eql(`${plug.deviceId}0${i}`);
              });
              done();
            }
          }
        });
    });

    it('should emit device-new for only the device and not each child for devices with children and breakoutChildren is false', function (done) {
      const devices: Record<string, Plug> = {};
      client
        .startDiscovery({
          discoveryInterval: 250,
          deviceTypes: ['plug'],
          breakoutChildren: false,
        })
        .on('device-new', (device) => {
          if (/^HS300/.exec(device.model)) {
            const plug = device as Plug;
            expect(plug.children).to.have.property('size', 6);
            expect(plug.sysInfo.children).to.have.lengthOf(plug.children.size);
            expect(devices[plug.deviceId]).to.be.undefined;
            devices[plug.deviceId] = plug;
          }
        });
      setTimeout(() => {
        expect(Object.keys(devices)).length.to.be.above(0);
        done();
      }, 1000);
    });

    it('should create devices using default port (9999) when devicesUseDiscoveryPort is false', function (done) {
      const devices: (Bulb | Plug)[] = [];
      client
        .startDiscovery({
          discoveryInterval: 250,
          devicesUseDiscoveryPort: false,
        })
        .on('device-new', (device) => {
          devices.push(device);
        });

      setTimeout(() => {
        client.stopDiscovery();
        expect(devices.length).to.be.greaterThan(0);
        devices.forEach((d) => expect(d.port).to.eql(9999));
        done();
      }, 1000);
    });

    it('should create devices using response port when devicesUseDiscoveryPort is true', function (done) {
      // This test assumes at least one test device is not responding to discovery 9999
      const devices: (Bulb | Plug)[] = [];
      client
        .startDiscovery({
          discoveryInterval: 250,
          devicesUseDiscoveryPort: true,
        })
        .on('device-new', (device) => {
          devices.push(device);
        });

      setTimeout(() => {
        client.stopDiscovery();
        expect(devices.length).to.be.greaterThan(0);
        expect(devices.findIndex((d) => d.port !== 9999)).to.not.eql(-1);
        done();
      }, 1000);
    });
  });

  config.testSendOptionsSets.forEach((sendOptions) => {
    context(sendOptions.name, function () {
      this.retries(1);
      describe('#getDevice()', function () {
        let client: Client;
        let device: AnyDevice;

        before('before client #getDevice()', async function () {
          client = getTestClient(
            sendOptions as unknown as ClientConstructorOptions,
          );
          device = await client.getDevice(
            testDevices.anyDevice.deviceOptions as NonNullable<
              TestDevice['deviceOptions']
            >,
          );
        });

        after(function () {
          device.closeConnection();
        });

        it('should find a device by IP address', function () {
          return expect(device.getSysInfo()).to.eventually.have.property(
            'err_code',
            0,
          );
        });

        it('should be rejected with an invalid IP address', async function () {
          let error;
          const { deviceOptions } = testDevices.unreachable;
          try {
            const dev = await client.getDevice(
              deviceOptions as NonNullable<TestDevice['deviceOptions']>,
              {
                timeout: 500,
              },
            );
            dev.closeConnection();
          } catch (err) {
            error = err;
          }
          expect(error).to.be.instanceOf(Error);
        });
      });

      describe('#getPlug()', function () {
        let skipped = false;
        let client: Client;
        let plug: Plug;
        let unreachablePlug: Plug;
        let sysInfo;

        before('before client #getPlug()', async function () {
          if (!('getDevice' in testDevices.anyPlug)) {
            skipped = true;
            this.skip();
          }

          client = getTestClient(
            sendOptions as unknown as ClientConstructorOptions,
          );
          const { host, port } = testDevices.anyPlug.deviceOptions ?? {};
          sysInfo = await client.getSysInfo(host as string, port);

          plug = client.getPlug({
            ...testDevices.anyPlug.deviceOptions,
            sysInfo,
          } as Parameters<Client['getPlug']>[0]);

          unreachablePlug = client.getPlug({
            ...testDevices.unreachable.deviceOptions,
            sysInfo,
          } as Parameters<Client['getPlug']>[0]);
        });

        after(function () {
          if (skipped) return;
          plug.closeConnection();
        });

        it('should find a plug by IP address', function () {
          return expect(plug.getSysInfo()).to.eventually.have.property(
            'err_code',
            0,
          );
        });

        it('should be rejected with an invalid IP address', function () {
          return expect(unreachablePlug.getSysInfo({ timeout: 500 })).to
            .eventually.be.rejected;
        });
      });

      describe('#getBulb()', function () {
        let skipped = false;
        let client: Client;
        let bulb: Bulb;
        let unreachableBulb: Bulb;
        let sysInfo;

        before('before client #getBulb()', async function () {
          if (!('getDevice' in testDevices.anyBulb)) {
            skipped = true;
            this.skip();
          }

          client = getTestClient(
            sendOptions as unknown as ClientConstructorOptions,
          );

          const { host, port } = testDevices.anyBulb.deviceOptions ?? {};
          sysInfo = await client.getSysInfo(host as string, port);

          bulb = client.getBulb({
            ...testDevices.anyBulb.deviceOptions,
            sysInfo,
          } as Parameters<Client['getBulb']>[0]);
          unreachableBulb = client.getBulb({
            ...testDevices.unreachable.deviceOptions,
            sysInfo,
          } as Parameters<Client['getBulb']>[0]);
        });

        after(function () {
          if (skipped) return;
          bulb.closeConnection();
        });

        it('should find a bulb by IP address', function () {
          return expect(bulb.getSysInfo()).to.eventually.have.property(
            'err_code',
            0,
          );
        });

        it('should be rejected with an invalid IP address', function () {
          return expect(unreachableBulb.getSysInfo({ timeout: 500 })).to
            .eventually.be.rejected;
        });
      });
    });

    describe('.send()', function () {
      let client: Client;
      let options: NonNullable<TestDevice['deviceOptions']>;
      before('before client .send()', function () {
        client = getTestClient(
          sendOptions as unknown as ClientConstructorOptions,
        );
        options = testDevices.anyDevice.deviceOptions as NonNullable<
          TestDevice['deviceOptions']
        >;
      });
      (['tcp', 'udp'] as const).forEach((transport) => {
        it(`should return info with string payload ${transport}`, async function () {
          return expect(
            JSON.parse(
              await client.send(
                '{"system":{"get_sysinfo":{}}}',
                options.host,
                options.port,
                { sendOptions: { transport } } as unknown as SendOptions,
              ),
            ),
          ).to.have.nested.property('system.get_sysinfo.err_code', 0);
        });
        it(`should return info with object payload ${sendOptions.transport}`, async function () {
          return expect(
            JSON.parse(
              await client.send(
                { system: { get_sysinfo: {} } },
                options.host,
                options.port,
                { sendOptions: { transport } } as unknown as SendOptions,
              ),
            ),
          ).to.have.nested.property('system.get_sysinfo.err_code', 0);
        });

        it(`should return info with object payload ${sendOptions.transport}`, async function () {
          return expect(
            JSON.parse(
              await client.send(
                { system: { get_sysinfo: {} } },
                options.host,
                options.port,
                { sendOptions: { transport } } as unknown as SendOptions,
              ),
            ),
          ).to.have.nested.property('system.get_sysinfo.err_code', 0);
        });
      });
    });
  });
});
