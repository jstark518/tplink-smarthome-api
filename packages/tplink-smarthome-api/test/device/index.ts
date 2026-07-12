/* eslint-disable no-unused-expressions */
// spell-checker:ignore MYTESTMAC MYTESTMICMAC MYTESTETHERNETMAC

import {
  config,
  createUnresponsiveDevice,
  expect,
  retry,
  testDevices,
} from '../setup';

import type { AnyDevice } from '../../src';
import { Client, ResponseError } from '../../src';
import type { Logger } from '../../src/logger';

import cloudTests from '../shared/cloud';
import emeterTests from '../shared/emeter';
import netifTests from './netif';
import scheduleTests from '../shared/schedule';
import timeTests from '../shared/time';

// The old JS called getDeviceFromSysInfo() with a single arg, leaving
// deviceOptions undefined; preserve that runtime behavior via a cast.
const emptyDeviceOptions = undefined as unknown as Parameters<
  Client['getDeviceFromSysInfo']
>[1];

// Tests intentionally mutate/delete fields on the cached sysInfo to exercise
// the getters' fallback logic. The real Sysinfo type is stricter, so use a
// permissive view for those blocks.
type MutableSysInfo = Record<string, unknown> & {
  children: { id: string; alias: string }[];
};

// Raw device responses are dynamic JSON; parse into a permissive nested shape
// so member access is type-checked without spreading `any`.
type JsonResponse = { [key: string]: JsonResponse } & {
  err_code?: number;
};
const parseResponse = (raw: string): JsonResponse =>
  JSON.parse(raw) as JsonResponse;

describe('Device', function () {
  this.timeout(config.defaultTestTimeout);
  this.slow(config.defaultTestTimeout / 2);
  this.retries(1);

  describe('#send() localAddress option (TCP)', function () {
    it('binds the outgoing socket to localAddress and still reaches the device', async function () {
      // localAddress binds the local end of the TCP socket (see #1). Only
      // meaningful against the loopback simulator.
      if (!config.useSimulator) this.skip();
      const testDevice = testDevices.anyDevice;
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime value may be undefined even though the type marks it required
      if (!testDevice.getDevice) this.skip();

      const device = await testDevice.getDevice(undefined, {
        transport: 'tcp',
        localAddress: '127.0.0.1',
        timeout: 2000,
      });
      await expect(device.getSysInfo()).to.eventually.be.an('object');
      device.closeConnection();
    });
  });

  testDevices.devices.forEach((testDevice) => {
    config.testSendOptionsSets.forEach((testSendOptions) => {
      context(testSendOptions.name, function () {
        context(testDevice.name, function () {
          const ctx: { device?: AnyDevice; supportsEmeter?: boolean } = {};
          let device: AnyDevice;
          let time: string;

          before('device', async function () {
            this.timeout(20000);
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime value may be undefined even though the type marks it required
            if (!testDevice.getDevice) this.skip();

            await retry(async () => {
              device = await testDevice.getDevice(undefined, testSendOptions);
              await device.getSysInfo();
              ctx.device = device;
              ctx.supportsEmeter = device.supportsEmeter;
              time = device.apiModules.timesetting;
            }, 2);
          });

          beforeEach('device', function () {
            // before() doesn't skip nested describes
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime value may be undefined even though the type marks it required
            if (!testDevice.getDevice) this.skip();
          });

          afterEach('device', function () {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime value may be undefined even though the type marks it required
            if (!testDevice.getDevice) this.skip();

            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- device is only assigned in before(); may be undefined if setup was skipped
            if (device !== undefined) device.closeConnection();
          });

          describe('constructor', function () {
            it('should inherit defaultSendOptions from Client', function () {
              const timeout = 9999;
              const transport = 'udp';
              const clientTest = new Client({
                defaultSendOptions: { timeout, transport },
              });

              const anotherDevice = clientTest.getDeviceFromSysInfo(
                device.sysInfo,
                emptyDeviceOptions,
              );

              expect(clientTest.defaultSendOptions.timeout, 'client').to.equal(
                timeout,
              );
              expect(
                clientTest.defaultSendOptions.transport,
                'client',
              ).to.equal(transport);
              expect(
                anotherDevice.defaultSendOptions.timeout,
                'device',
              ).to.equal(timeout);
              expect(
                anotherDevice.defaultSendOptions.transport,
                'device',
              ).to.equal(transport);
            });

            it('should inherit logger from Client', function () {
              const logger = {
                debug: (): void => {},
              } as unknown as Logger;

              const clientTest = new Client({ logger });

              const anotherDevice = clientTest.getDeviceFromSysInfo(
                device.sysInfo,
                emptyDeviceOptions,
              );

              expect(clientTest.log.debug, 'client').to.equal(
                anotherDevice.log.debug,
              );
            });
          });

          describe('#send', function () {
            it('should send a single valid command and receive response', async function () {
              const response = parseResponse(
                await device.send('{"system":{"get_sysinfo":{}}}'),
              );
              expect(response).to.have.nested.property(
                'system.get_sysinfo.err_code',
                0,
              );
            });
            it('should send multiple valid commands (same module) and receive response', async function () {
              const response = parseResponse(
                await device.send(
                  `{"${time}":{"get_time":{},"get_timezone":{}}}`,
                ),
              );
              expect(response[time]?.get_time?.err_code).to.eql(0);
              expect(response[time]?.get_timezone?.err_code).to.eql(0);
            });
            it('should send multiple valid commands (diff modules) and receive response', async function () {
              const response = parseResponse(
                await device.send(
                  `{"system":{"get_sysinfo":{}},"${time}":{"get_time":{}}}`,
                ),
              );
              expect(response).to.have.nested.property(
                'system.get_sysinfo.err_code',
                0,
              );
              expect(response[time]?.get_time?.err_code).to.eql(0);
            });
            it('should send a single invalid command (member) and receive response', async function () {
              const response = parseResponse(
                await device.send('{"system":{"INVALID_MEMBER":{}}}'),
              );
              expect(response.system?.INVALID_MEMBER?.err_code).to.be.oneOf([
                -2, -2000,
              ]);
            });
            it('should send a single invalid command (module) and receive response', async function () {
              const response = parseResponse(
                await device.send('{"INVALID_MODULE":{"INVALID_MEMBER":{}}}'),
              );
              expect(response).to.have.nested.property(
                'INVALID_MODULE.err_code',
              );
              expect(response.INVALID_MODULE?.err_code).to.be.oneOf([
                -1, -2001,
              ]);
            });
            it('should send multiple invalid commands and receive response', async function () {
              const response = parseResponse(
                await device.send(
                  '{"system":{"INVALID_MEMBER":{}},"INVALID_MODULE":{"INVALID_MEMBER":{}}}',
                ),
              );
              expect(response.INVALID_MODULE?.err_code).to.be.oneOf([
                -1, -2001,
              ]);
              expect(response.system?.INVALID_MEMBER?.err_code).to.be.oneOf([
                -2, -2000,
              ]);
            });

            it('should reject with an unreachable host', async function () {
              const unreachableDevice = await testDevice.getDevice();
              unreachableDevice.host =
                testDevices.unreachable.deviceOptions?.host ?? '';

              expect(unreachableDevice.send('{"system":{"get_sysinfo":{}}}')).to
                .be.eventually.rejected;
            });

            describe('unresponsive', function () {
              let unresponsive: Awaited<
                ReturnType<typeof createUnresponsiveDevice>
              >;
              let unresponsiveDevice: AnyDevice;
              beforeEach(async function () {
                unresponsive = await createUnresponsiveDevice(
                  testSendOptions.transport,
                );
                unresponsiveDevice = await testDevice.getDevice();
                unresponsiveDevice.host = unresponsive.host;
                unresponsiveDevice.port = unresponsive.port;
              });
              afterEach(function () {
                unresponsive.close();
              });

              it("should reject with a host that doesn't respond", function () {
                this.timeout(5000);
                expect(
                  unresponsiveDevice.send('{"system":{"get_sysinfo":{}}}', {
                    timeout: 4000,
                  }),
                ).to.be.eventually.rejected;
              });
            });
          });

          describe('#sendCommand', function () {
            it('should send a single valid command and receive response', async function () {
              const response = await device.sendCommand(
                '{"system":{"get_sysinfo":{}}}',
              );
              return expect(response).to.have.property('err_code', 0);
            });
            it('should send multiple valid commands (same module) and receive response', async function () {
              const response = (await device.sendCommand(
                `{"${time}":{"get_time":{},"get_timezone":{}}}`,
              )) as Record<
                string,
                {
                  get_time: { err_code: number };
                  get_timezone: { err_code: number };
                }
              >;

              expect(response[time]?.get_time.err_code).to.eql(0);
              expect(response[time]?.get_timezone.err_code).to.eql(0);
            });
            it('should send multiple valid commands (diff modules) and receive response', async function () {
              const response = (await device.sendCommand(
                `{"system":{"get_sysinfo":{}},"${time}":{"get_time":{}}}`,
              )) as Record<string, { get_time: { err_code: number } }>;
              expect(response).to.have.nested.property(
                'system.get_sysinfo.err_code',
                0,
              );
              expect(response[time]?.get_time.err_code).to.eql(0);
            });
            it('should send a single invalid command (member) and reject with ResponseError', function () {
              return device
                .sendCommand('{"system":{"INVALID_MEMBER":{}}}')
                .catch((err: ResponseError) => {
                  expect(err).to.be.instanceof(ResponseError);
                  expect(parseResponse(err.response)).to.have.nested.property(
                    'err_code',
                  );
                  expect(parseResponse(err.response).err_code).to.be.oneOf([
                    -2, -2000,
                  ]);
                });
            });
            it('should send a single invalid command (module) and reject with ResponseError', function () {
              return device
                .sendCommand('{"INVALID_MODULE":{"INVALID_MEMBER":{}}}')
                .catch((err: ResponseError) => {
                  expect(err).to.be.instanceof(ResponseError);
                  expect(parseResponse(err.response)).to.have.nested.property(
                    'err_code',
                  );
                  expect(parseResponse(err.response).err_code).to.be.oneOf([
                    -1, -2001,
                  ]);
                });
            });
            it('should send multiple invalid commands and reject with ResponseError', function () {
              return device
                .sendCommand(
                  '{"system":{"INVALID_MEMBER":{}},"INVALID_MODULE":{"INVALID_MEMBER":{}}}',
                )
                .catch((err: ResponseError) => {
                  expect(err).to.be.an.instanceof(ResponseError);
                  expect(
                    parseResponse(err.response).INVALID_MODULE?.err_code,
                  ).to.be.oneOf([-1, -2001]);
                  expect(
                    parseResponse(err.response).system?.INVALID_MEMBER
                      ?.err_code,
                  ).to.be.oneOf([-2, -2000]);
                });
            });
            it('should send multiple commands to a single device at once', async function () {
              const promises: Promise<unknown>[] = [];
              for (let i = 0; i < 20; i += 1) {
                promises.push(
                  device.sendCommand('{"system":{"get_sysinfo":{}}}'),
                );
              }

              const responses = await Promise.all(promises);

              for (let i = 0; i < 20; i += 1) {
                expect(responses[i]).to.have.property('err_code', 0);
              }
            });
            it('should reject with an unreachable host', async function () {
              const unreachableDevice = await testDevice.getDevice();
              unreachableDevice.host =
                testDevices.unreachable.deviceOptions?.host ?? '';

              expect(
                unreachableDevice.sendCommand('{"system":{"get_sysinfo":{}}}'),
              ).to.be.eventually.rejected;
            });
          });

          describe('#sysInfo get', function () {
            it('should return sysInfo after getSysInfo called', async function () {
              const si = await device.getSysInfo();
              expect(device.sysInfo).to.eql(si);
            });
          });

          describe('#alias get', function () {
            it('should return alias from cached sysInfo', function () {
              const sysInfo = device.sysInfo as unknown as MutableSysInfo;
              if (device.childId) {
                const child = sysInfo.children.find(
                  (c) => c.id === device.childId,
                );
                expect(device.alias).to.eql(child?.alias);
                if (child) child.alias = 'My Test Alias';
                expect(device.alias).to.eql(child?.alias);
              } else {
                expect(device.alias).to.eql(sysInfo.alias);
                sysInfo.alias = 'My Test Alias';
                expect(device.alias).to.eql(sysInfo.alias);
              }
            });
          });

          describe('#deviceId get', function () {
            it('should return deviceId from cached sysInfo', function () {
              const sysInfo = device.sysInfo as unknown as MutableSysInfo;
              expect(device.deviceId).to.eql(sysInfo.deviceId);
              sysInfo.deviceId = 'My Test deviceId';
              expect(device.deviceId).to.eql(sysInfo.deviceId);
            });
          });

          describe('#description get', function () {
            it('should return description from cached sysInfo', function () {
              const sysInfo = device.sysInfo as unknown as MutableSysInfo;
              expect(device.description).to.eql(
                sysInfo.description || sysInfo.dev_name,
              );
            });
          });

          describe('#model get', function () {
            it('should return model from cached sysInfo', function () {
              const sysInfo = device.sysInfo as unknown as MutableSysInfo;
              expect(device.model).to.eql(sysInfo.model);
              sysInfo.model = 'My Test model';
              expect(device.model).to.eql(sysInfo.model);
            });
          });

          describe('#type get', function () {
            it('should return type from cached sysInfo', function () {
              const sysInfo = device.sysInfo as unknown as MutableSysInfo;
              expect(device.type).to.eql(sysInfo.type || sysInfo.mic_type);
              sysInfo.type = 'My Test type';
              delete sysInfo.mic_type;
              expect(device.type).to.eql(sysInfo.type);
              delete sysInfo.type;
              sysInfo.mic_type = 'My Test mic_type';
              expect(device.type).to.eql(sysInfo.mic_type);
            });
          });

          describe('#deviceType get', function () {
            it('should return deviceType', function () {
              expect(device.deviceType).to.eql(testDevice.deviceType);
            });
          });

          describe('#softwareVersion get', function () {
            it('should return softwareVersion from cached sysInfo', function () {
              const sysInfo = device.sysInfo as unknown as MutableSysInfo;
              expect(device.softwareVersion).to.eql(sysInfo.sw_ver);
              sysInfo.sw_ver = 'My Test sw_ver';
              expect(device.softwareVersion).to.eql(sysInfo.sw_ver);
            });
          });

          describe('#hardwareVersion get', function () {
            it('should return hardwareVersion from cached sysInfo', function () {
              const sysInfo = device.sysInfo as unknown as MutableSysInfo;
              expect(device.hardwareVersion).to.eql(sysInfo.hw_ver);
              sysInfo.hw_ver = 'My Test hw_ver';
              expect(device.hardwareVersion).to.eql(sysInfo.hw_ver);
            });
          });

          describe('#mac get', function () {
            it('should return mac from cached sysInfo', function () {
              const sysInfo = device.sysInfo as unknown as MutableSysInfo;
              expect(device.mac).to.eql(
                sysInfo.mac || sysInfo.mic_mac || sysInfo.ethernet_mac,
              );
              sysInfo.mac = 'My Test mac';
              delete sysInfo.mic_mac;
              delete sysInfo.ethernet_mac;
              expect(device.mac).to.eql(sysInfo.mac);
              delete sysInfo.mac;
              sysInfo.mic_mac = 'My Test mic_mac';
              delete sysInfo.ethernet_mac;
              expect(device.mac).to.eql(sysInfo.mic_mac);
              delete sysInfo.mac;
              delete sysInfo.mic_mac;
              sysInfo.ethernet_mac = 'My Test ethernet_mac';
              expect(device.mac).to.eql(sysInfo.ethernet_mac);
            });
          });

          describe('#macNormalized get', function () {
            it('should return normalized mac from cached sysInfo', function () {
              const sysInfo = device.sysInfo as unknown as MutableSysInfo;
              sysInfo.mac = 'My Test mac';
              delete sysInfo.mic_mac;
              delete sysInfo.ethernet_mac;
              expect(device.macNormalized).to.eql('MYTESTMAC');
              delete sysInfo.mac;
              sysInfo.mic_mac = 'My Test mic_mac';
              delete sysInfo.ethernet_mac;
              expect(device.macNormalized).to.eql('MYTESTMICMAC');
              delete sysInfo.mac;
              delete sysInfo.mic_mac;
              sysInfo.ethernet_mac = 'My Test ethernet_mac';
              expect(device.macNormalized).to.eql('MYTESTETHERNETMAC');
            });
          });

          describe('#getSysInfo()', function () {
            it('should return info', function () {
              return expect(device.getSysInfo()).to.eventually.have.property(
                'err_code',
                0,
              );
            });
          });

          describe('#setAlias()', function () {
            let origAlias: string;
            before('setAlias', async function () {
              // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime value may be undefined even though the type marks it required
              if (!testDevice.getDevice) return;
              await device.getSysInfo();
              origAlias = device.alias;
            });
            after(async function () {
              // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime value may be undefined even though the type marks it required
              if (!testDevice.getDevice) return;
              expect(await device.setAlias(origAlias)).to.be.true;
              await device.getSysInfo();
              expect(device.alias).to.equal(origAlias);
            });

            it('should change the alias', async function () {
              const testAlias = `Testing ${Math.floor(
                Math.random() * (100 + 1),
              )}`;
              expect(await device.setAlias(testAlias)).to.be.true;
              await device.getSysInfo();
              expect(device.alias).to.equal(testAlias);
            });
          });

          describe('#setLocation()', function () {
            it('should return model', function () {
              return expect(
                device.setLocation(10, 10),
              ).to.eventually.have.property('err_code', 0);
            });
          });

          describe('#getModel()', function () {
            it('should return model', function () {
              return expect(device.getModel()).to.eventually.match(
                /^[A-Za-z]{2}\d\d\d|^[A-Za-z]{2}\d\d\d/,
              );
            });
          });

          describe('#reboot()', function () {
            it('(simulator only) should reboot', function () {
              if (!testDevice.isSimulated) this.skip();
              return expect(device.reboot(1)).to.eventually.have.property(
                'err_code',
                0,
              );
            });
          });

          describe('#reset()', function () {
            it('(simulator only) should reset', function () {
              if (!testDevice.isSimulated) this.skip();
              return expect(device.reset(1)).to.eventually.have.property(
                'err_code',
                0,
              );
            });
          });

          cloudTests(ctx, testDevice);
          emeterTests(ctx, testDevice);
          if (testDevice.supports == null || testDevice.supports.netif) {
            netifTests(ctx);
          }
          if (testDevice.supports == null || testDevice.supports.schedule) {
            scheduleTests(ctx, testDevice);
          }
          timeTests(ctx);
        });
      });
    });
  });
});
