import { config, expect, retry } from '../setup';

import type { Plug, PlugScheduleRuleInput } from '../../src';
import type { TestDevice } from '../setup/test-device';

type AddRuleResponse = { err_code: number; id: string };

// The device applies defaults for powerState/enable, so tests may omit them;
// cast to the input type to satisfy strict typing.
const plugScheduleRule = (
  rule: Partial<PlugScheduleRuleInput> & Pick<PlugScheduleRuleInput, 'start'>,
): PlugScheduleRuleInput => rule as PlugScheduleRuleInput;

export default function (ctx: { device?: Plug }, testDevice: TestDevice): void {
  describe('Schedule', function () {
    this.retries(1);
    let device: Plug;

    beforeEach('Schedule', async function () {
      this.timeout(20000);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime value may be undefined even though the type marks it required
      if (!testDevice.getDevice) this.skip();

      await retry(async () => {
        device = ctx.device as Plug;
        await device.schedule.deleteAllRules();
      }, 2);
    });

    describe('#addRule()', function () {
      it('should add non repeating rule', async function () {
        const response = await device.schedule.addRule(
          plugScheduleRule({
            powerState: true,
            start: 60,
          }),
        );
        expect(response).to.have.property('err_code', 0);
        expect(response).to.have.property('id');
      });
      it('should add repeating rule', async function () {
        const response = await device.schedule.addRule(
          plugScheduleRule({
            powerState: false,
            start: 120,
            daysOfWeek: [0, 6],
          }),
        );
        expect(response).to.have.property('err_code', 0);
        expect(response).to.have.property('id');
      });
      it('should add disabled rule', async function () {
        const response = await device.schedule.addRule(
          plugScheduleRule({
            powerState: false,
            start: 120,
            name: 'disabled',
            enable: false,
          }),
        );
        expect(response).to.have.property('err_code', 0);
        expect(response).to.have.property('id');
      });
      it('should add rule with dimmer (devices that support dimmer)', async function () {
        if (!device.supportsDimmer) this.skip();
        const inputRule = {
          dimmer: { on_off: 1, brightness: 54, transition_period: 1000 },
          start: 120,
          name: 'dimmer',
        };
        const response = (await device.schedule.addRule(
          plugScheduleRule(inputRule),
        )) as AddRuleResponse;
        expect(response).to.have.property('err_code', 0);
        expect(response).to.have.property('id');
        const rule = (await device.schedule.getRule(response.id)) as Record<
          string,
          unknown
        >;
        expect(rule.sact).to.eql(3);
        expect(rule.s_dimmer).to.eql(inputRule.dimmer);
      });
    });

    describe('#editRule()', function () {
      it('should edit a rule', async function () {
        this.timeout(config.defaultTestTimeout * 3);
        this.slow(config.defaultTestTimeout * 2);

        const addResponse = (await device.schedule.addRule(
          plugScheduleRule({
            powerState: false,
            start: 60,
          }),
        )) as AddRuleResponse;
        expect(addResponse).to.have.property('err_code', 0);
        expect(addResponse).to.have.property('id');

        const editResponse = await device.schedule.editRule({
          id: addResponse.id,
          powerState: true,
          start: 120,
          enable: false,
        });
        expect(editResponse).to.have.property('err_code', 0);

        const getResponse = await device.schedule.getRule(addResponse.id);
        expect(getResponse).to.have.property('err_code', 0);
        expect(getResponse).to.have.property('id', addResponse.id);
        expect(getResponse).to.have.property('sact', 1);
        expect(getResponse).to.have.property('smin', 120);
        expect(getResponse).to.have.property('enable', 0);
      });

      it('should edit a rule with dimmer (devices that support dimmer)', async function () {
        if (!device.supportsDimmer) this.skip();
        this.timeout(config.defaultTestTimeout * 3);
        this.slow(config.defaultTestTimeout * 2);

        const addRule = {
          dimmer: { on_off: 1, brightness: 54, transition_period: 1000 },
          start: 120,
          name: 'dimmer',
        };
        const addResponse = (await device.schedule.addRule(
          plugScheduleRule(addRule),
        )) as AddRuleResponse;
        expect(addResponse).to.have.property('err_code', 0);
        expect(addResponse).to.have.property('id');

        const editRule = {
          dimmer: { on_off: 1, brightness: 33, transition_period: 500 },
          start: 110,
        };
        const editResponse = await device.schedule.editRule({
          ...plugScheduleRule(editRule),
          id: addResponse.id,
        });
        expect(editResponse).to.have.property('err_code', 0);

        const getResponse = (await device.schedule.getRule(
          addResponse.id,
        )) as Record<string, unknown>;
        expect(getResponse).to.have.property('err_code', 0);
        expect(getResponse).to.have.property('id', addResponse.id);
        expect(getResponse).to.have.property('sact', 3);
        expect(getResponse).to.have.property('smin', 110);
        expect(getResponse.s_dimmer).to.eql(editRule.dimmer);
      });
    });
  });
}
