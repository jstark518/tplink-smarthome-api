/* eslint-disable no-unused-expressions */

import { config, expect } from '../setup';

import type { AwayRuleInput, Plug } from '../../src';

type AddRuleResponse = { err_code: number; id: string };

// The device applies defaults for daysOfWeek/frequency/enable, so tests may
// omit them; cast to the input type to satisfy strict typing.
type PartialAwayRuleInput = Partial<AwayRuleInput> &
  Pick<AwayRuleInput, 'start' | 'end'>;
const awayRule = (rule: PartialAwayRuleInput): AwayRuleInput =>
  rule as AwayRuleInput;

export default function (ctx: { device?: Plug }): void {
  describe('Away', function () {
    let device: Plug;

    beforeEach('Away', function () {
      device = ctx.device as Plug;
    });

    describe('#getRules()', function () {
      it('should return away rules', function () {
        return expect(device.away.getRules()).to.eventually.have.property(
          'err_code',
          0,
        );
      });
    });
    describe('#addRule()', function () {
      it('should add non repeating rule', async function () {
        const response = await device.away.addRule(
          awayRule({
            start: 60,
            end: 120,
          }),
        );
        expect(response).to.have.property('err_code', 0);
        expect(response).to.have.property('id');
      });
      it('should add repeating rule', async function () {
        const response = await device.away.addRule(
          awayRule({
            start: 120,
            end: 240,
            daysOfWeek: [0, 6],
          }),
        );
        expect(response).to.have.property('err_code', 0);
        expect(response).to.have.property('id');
      });
      it('should add disabled rule', async function () {
        const response = await device.away.addRule(
          awayRule({
            start: 120,
            end: 600,
            name: 'disabled',
            enable: false,
          }),
        );
        expect(response).to.have.property('err_code', 0);
        expect(response).to.have.property('id');
      });
    });

    describe('#editRule()', function () {
      it('should edit a rule', async function () {
        this.timeout(config.defaultTestTimeout * 3);
        this.slow(config.defaultTestTimeout * 2);

        const addResponse = (await device.away.addRule(
          awayRule({
            start: 60,
            end: 240,
          }),
        )) as AddRuleResponse;
        expect(addResponse).to.have.property('err_code', 0);
        expect(addResponse).to.have.property('id');

        const editResponse = await device.away.editRule({
          ...awayRule({
            start: 120,
            end: 600,
          }),
          id: addResponse.id,
        });
        expect(editResponse).to.have.property('err_code', 0);

        const getResponse = await device.away.getRule(addResponse.id);
        expect(getResponse).to.have.property('err_code', 0);
        expect(getResponse).to.have.property('id', addResponse.id);
        expect(getResponse).to.have.property('smin', 120);
        expect(getResponse).to.have.property('emin', 600);
      });
    });
    describe('#deleteAllRules()', function () {
      it('should delete all rules', async function () {
        const addResponse = await device.away.addRule(
          awayRule({
            start: 60,
            end: 240,
          }),
        );
        expect(addResponse, 'addRule').to.have.property('err_code', 0);
        expect(addResponse, 'addRule').to.have.property('id');

        const deleteResponse = await device.away.deleteAllRules();
        expect(deleteResponse).to.have.property('err_code', 0);

        const getResponse = await device.away.getRules();
        expect(getResponse).to.have.property('err_code', 0);
        expect(getResponse.rule_list).to.have.property('length', 0);
      });
    });
    describe('#deleteRule()', function () {
      it('should delete a rule', async function () {
        const addResponse = (await device.away.addRule(
          awayRule({
            start: 60,
            end: 240,
          }),
        )) as AddRuleResponse;
        expect(addResponse, 'addRule').to.have.property('err_code', 0);
        expect(addResponse, 'addRule').to.have.property('id');

        const deleteResponse = await device.away.deleteRule(addResponse.id);
        expect(deleteResponse).to.have.property('err_code', 0);

        const getResponse = await device.away.getRules();
        expect(getResponse).to.have.property('err_code', 0);
        const rule = getResponse.rule_list.find((r) => r.id === addResponse.id);
        expect(rule).to.be.undefined;
      });
    });
    describe('#setOverallEnable()', function () {
      it('should enable', async function () {
        expect(await device.away.setOverallEnable(true)).to.have.property(
          'err_code',
          0,
        );
      });
      it('should disable', async function () {
        expect(await device.away.setOverallEnable(false)).to.have.property(
          'err_code',
          0,
        );
      });
    });
  });
}
