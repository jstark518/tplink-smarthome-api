import { expect } from '../setup';

import type { Plug, TimerRuleInput } from '../../src';
import { ResponseError } from '../../src';

type AddRuleResponse = { err_code: number; id: string };
type TimerRules = { rule_list: { id: string; delay: number }[] };

// The device applies a default for enable, so tests may omit it; cast to the
// input type to satisfy strict typing.
type TimerAddInput = TimerRuleInput & { deleteExisting: boolean };
const timerRule = (
  rule: Partial<TimerAddInput> & Pick<TimerAddInput, 'delay' | 'powerState'>,
): TimerAddInput => rule as TimerAddInput;

export default function (ctx: { device?: Plug }): void {
  describe('Timer', function () {
    let device: Plug;

    beforeEach('Timer', function () {
      device = ctx.device as Plug;
    });

    describe('#getRules()', function () {
      it('should return timer rules', function () {
        return expect(device.timer.getRules()).to.eventually.have.property(
          'err_code',
          0,
        );
      });
    });

    describe('#addRule()', function () {
      it('should add timer rule', async function () {
        const response = (await device.timer.addRule(
          timerRule({
            delay: 20,
            powerState: false,
          }),
        )) as AddRuleResponse;
        expect(response).to.have.property('err_code', 0);
        expect(response).to.have.property('id').that.is.a('string');

        const { id } = response;
        const rules = (await device.timer.getRules()) as TimerRules;
        expect(rules.rule_list[0]?.id).to.eql(id);
      });

      it('should delete existing rules and add timer rule when deleteExisting is true', async function () {
        await device.timer.addRule(
          timerRule({
            delay: 20,
            powerState: false,
            deleteExisting: true,
          }),
        );

        const response = await device.timer.addRule(
          timerRule({
            delay: 50,
            powerState: false,
            deleteExisting: true,
          }),
        );
        expect(response).to.have.property('err_code', 0);
        expect(response).to.have.property('id').that.is.a('string');
      });

      it('should fail if a timer rule exists when deleteExisting is false', async function () {
        await device.timer.addRule(
          timerRule({
            delay: 20,
            powerState: false,
            deleteExisting: true,
          }),
        );
        await expect(
          device.timer.addRule(
            timerRule({
              delay: 20,
              powerState: false,
              deleteExisting: false,
            }),
          ),
        ).to.eventually.be.rejectedWith(ResponseError);
      });
    });

    describe('#editRule()', function () {
      it('should edit timer rule', async function () {
        const response = (await device.timer.addRule(
          timerRule({
            delay: 20,
            powerState: false,
          }),
        )) as AddRuleResponse;
        expect(response).to.have.property('err_code', 0);
        expect(response).to.have.property('id').that.is.a('string');

        const { id } = response;

        await device.timer.editRule({
          id,
          delay: 50,
          powerStart: false,
        } as unknown as TimerRuleInput & { id: string });

        const rules = (await device.timer.getRules()) as TimerRules;
        expect(rules.rule_list[0]?.id).to.eql(id);
        expect(rules.rule_list[0]?.delay).to.eql(50);
      });
    });

    describe('#deleteAllRules()', function () {
      it('should delete timer rules', function () {
        return expect(
          device.timer.deleteAllRules(),
        ).to.eventually.have.property('err_code', 0);
      });
    });
  });
}
