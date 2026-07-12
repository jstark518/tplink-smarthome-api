import { config, expect } from '../setup';

import type { AnyDevice } from '../../src';

export default function (ctx: { device?: AnyDevice }): void {
  describe('Netif', function () {
    let device: AnyDevice;

    beforeEach('Away', function () {
      device = ctx.device as AnyDevice;
    });

    describe('#getScanInfo() @slow', function () {
      it('should return scan info', function () {
        this.timeout(config.defaultTestTimeout * 4);
        this.slow(config.defaultTestTimeout * 2);
        return expect(
          device.netif.getScanInfo(true, 2),
        ).to.eventually.have.property('err_code', 0);
      });

      it('should return cached scan info', function () {
        return expect(
          device.netif.getScanInfo(false),
        ).to.eventually.have.property('err_code', 0);
      });
    });
  });
}
