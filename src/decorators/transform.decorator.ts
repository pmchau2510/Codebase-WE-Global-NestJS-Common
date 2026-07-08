import { Transform } from 'class-transformer';
import { applyDecorators } from '@nestjs/common';
import { includes, isNil } from 'lodash';

export function TransformToNumber() {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) => {
      const isNull = isNil(value);
      if (isNull) {
        return null;
      }

      const numericValue = Number(value);
      return Number.isNaN(numericValue) ? null : numericValue;
    }),
  );
}

export function TransformToBoolean() {
  return applyDecorators(
    Transform(({ value }) => {
      if (isNil(value)) {
        return value;
      }
      if (Array.isArray(value)) {
        return value.map((v) => includes(['true', true, 1, '1'], v));
      }
      return includes(['true', true, 1, '1'], value);
    }),
  );
}

export function TransformToArray() {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) => {
      if (isNil(value)) {
        return value;
      }
      return Array.isArray(value) ? (value as unknown[]) : [value];
    }),
  );
}
