import { describe, expect, test } from 'bun:test';
import { canChangeStatus, isValidStatusTransition } from './permissions';

describe('task status permissions', () => {
  test('prevents a product manager from completing an in-progress task', () => {
    expect(canChangeStatus('PRODUCT_MANAGER', 'IN_PROGRESS', 'DONE')).toBe(false);
  });

  test('allows an assigned team status transition', () => {
    expect(canChangeStatus('BACKEND', 'TODO', 'IN_PROGRESS')).toBe(true);
    expect(isValidStatusTransition('TODO', 'IN_PROGRESS')).toBe(true);
  });

  test('rejects invalid status transitions', () => {
    expect(isValidStatusTransition('TODO', 'DONE')).toBe(false);
    expect(isValidStatusTransition('BLOCKED', 'DONE')).toBe(false);
  });

  test('allows a product manager to complete an assigned task', () => {
    expect(canChangeStatus('PRODUCT_MANAGER', 'IN_PROGRESS', 'DONE', 'pm-id', 'pm-id')).toBe(true);
    expect(canChangeStatus('PRODUCT_MANAGER', 'IN_PROGRESS', 'DONE', 'executor-id', 'pm-id')).toBe(
      false,
    );
  });
});
