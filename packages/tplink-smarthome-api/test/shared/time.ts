import { expect } from '../setup';

import type { AnyDevice } from '../../src';

export default function (ctx: { device?: AnyDevice }): void {
  describe('Time', function () {
    let device: AnyDevice;

    beforeEach('Time', function () {
      device = ctx.device as AnyDevice;
    });

    describe('#getTime()', function () {
      it('should return time', function () {
        return expect(device.time.getTime()).to.eventually.have.property(
          'err_code',
          0,
        );
      });
    });

    describe('#getTimezone()', function () {
      it('should return get time zone', function () {
        return expect(device.time.getTimezone()).to.eventually.have.property(
          'err_code',
          0,
        );
      });
    });
  });
}
