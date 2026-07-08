import { Test } from '@nestjs/testing';
import { DemoController } from './demo.controller';

describe('DemoController', () => {
  it('returns a confirmation message', () => {
    const controller = new DemoController();
    expect(controller.adminOnly()).toEqual({ message: 'You are an authenticated admin.' });
  });
});
