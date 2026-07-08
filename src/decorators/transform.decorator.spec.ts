import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { TransformToArray, TransformToBoolean, TransformToNumber } from './transform.decorator';

class Dto {
  @TransformToNumber()
  page?: number;

  @TransformToBoolean()
  active?: boolean;

  @TransformToArray()
  tags?: string[];
}

describe('transform decorators', () => {
  it('coerces string to number, invalid to null', () => {
    expect(plainToInstance(Dto, { page: '10' }).page).toBe(10);
    expect(plainToInstance(Dto, { page: 'abc' }).page).toBeNull();
    expect(plainToInstance(Dto, {}).page).toBeUndefined();
  });

  it('coerces truthy-ish strings to boolean', () => {
    expect(plainToInstance(Dto, { active: 'true' }).active).toBe(true);
    expect(plainToInstance(Dto, { active: '0' }).active).toBe(false);
  });

  it('wraps scalar into array, leaves array as-is', () => {
    expect(plainToInstance(Dto, { tags: 'a' }).tags).toEqual(['a']);
    expect(plainToInstance(Dto, { tags: ['a', 'b'] }).tags).toEqual(['a', 'b']);
  });
});
