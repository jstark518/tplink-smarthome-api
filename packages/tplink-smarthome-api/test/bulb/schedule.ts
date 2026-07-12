import { config, expect } from '../setup';

import type { AnyDevice, Bulb, BulbScheduleRuleInput } from '../../src';
import type { TestDevice } from '../setup/test-device';

type AddRuleResponse = { err_code: number; id: string };

export default function (
  ctx: { device?: AnyDevice },
  testDevice: TestDevice,
): void {
  describe('Schedule', function () {
    let lightState: BulbScheduleRuleInput['lightState'];
    let device: Bulb;

    beforeEach('Schedule', async function () {
      this.retries(1);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime value may be undefined even though the type marks it required
      if (!testDevice.getDevice) this.skip();

      device = ctx.device as Bulb;

      await device.schedule.deleteAllRules();
      lightState = {
        saturation: 0,
        hue: 0,
        brightness: 0,
        color_temp: 0,
        mode: 'last_status',
        on_off: 0,
      };
    });

    describe('#addRule()', function () {
      it('should add non repeating rule', async function () {
        const response = await device.schedule.addRule({
          lightState,
          start: 60,
        } as BulbScheduleRuleInput);
        expect(response).to.have.property('err_code', 0);
        expect(response).to.have.property('id');
      });

      it('should add repeating rule', async function () {
        const response = await device.schedule.addRule({
          lightState,
          start: 120,
          daysOfWeek: [0, 6],
        } as BulbScheduleRuleInput);
        expect(response).to.have.property('err_code', 0);
        expect(response).to.have.property('id');
      });

      it('should add disabled rule', async function () {
        const response = await device.schedule.addRule({
          lightState,
          start: 120,
          name: 'disabled',
          enable: false,
        });
        expect(response).to.have.property('err_code', 0);
        expect(response).to.have.property('id');
      });
    });

    describe('#editRule()', function () {
      it('should edit a rule', async function () {
        this.timeout(config.defaultTestTimeout * 3);
        this.slow(config.defaultTestTimeout * 2);

        const addResponse = (await device.schedule.addRule({
          lightState,
          start: 60,
        } as BulbScheduleRuleInput)) as AddRuleResponse;
        expect(addResponse).to.have.property('err_code', 0);
        expect(addResponse).to.have.property('id');

        lightState = { ...lightState, hue: 100 };
        const editResponse = await device.schedule.editRule({
          id: addResponse.id,
          lightState,
          start: 120,
        } as BulbScheduleRuleInput & { id: string });
        expect(editResponse).to.have.property('err_code', 0);

        const getResponse = (await device.schedule.getRule(
          addResponse.id,
        )) as unknown as {
          err_code: number;
          id: string;
          s_light: { hue: number };
          smin: number;
        };
        expect(getResponse).to.have.property('err_code', 0);
        expect(getResponse).to.have.property('id', addResponse.id);
        expect(getResponse.s_light.hue).to.eql(100);
        expect(getResponse.smin).to.eql(120);
      });
    });
  });
}
