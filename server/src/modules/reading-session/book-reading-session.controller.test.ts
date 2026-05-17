import { describe, expect, it, vi } from 'vitest';

import { BookReadingSessionController } from './book-reading-session.controller';

describe('BookReadingSessionController', () => {
  it('delegates listSessions to service.listByBook', async () => {
    const mockResult = { items: [], total: 0, page: 1, pageSize: 25, stats: {} };
    const service = { listByBook: vi.fn().mockResolvedValue(mockResult) };
    const controller = new BookReadingSessionController(service as never);
    const user = { id: 7 } as never;
    const query = { page: 1, pageSize: 25, sortBy: 'startedAt' as const, sortDir: 'desc' as const };

    const result = await controller.listSessions(10, query, user);

    expect(service.listByBook).toHaveBeenCalledWith(10, user, query);
    expect(result).toBe(mockResult);
  });

  it('delegates deleteSession to service.deleteSessionByBook', async () => {
    const service = { deleteSessionByBook: vi.fn().mockResolvedValue(undefined) };
    const controller = new BookReadingSessionController(service as never);
    const user = { id: 7 } as never;

    await controller.deleteSession(10, 5, user);

    expect(service.deleteSessionByBook).toHaveBeenCalledWith(10, 5, user);
  });

  it('listSessions handles different query params', async () => {
    const mockResult = { items: [], total: 5, page: 2, pageSize: 10, stats: {} };
    const service = { listByBook: vi.fn().mockResolvedValue(mockResult) };
    const controller = new BookReadingSessionController(service as never);
    const user = { id: 7 } as never;
    const query = { page: 2, pageSize: 10, sortBy: 'durationSeconds' as const, sortDir: 'asc' as const, dateFrom: '2026-01-01' };

    const result = await controller.listSessions(10, query, user);

    expect(service.listByBook).toHaveBeenCalledWith(10, user, query);
    expect(result).toBe(mockResult);
  });

  it('deleteSession propagates errors from service', async () => {
    const { NotFoundException } = await import('@nestjs/common');
    const service = { deleteSessionByBook: vi.fn().mockRejectedValue(new NotFoundException('Reading session not found')) };
    const controller = new BookReadingSessionController(service as never);
    const user = { id: 7 } as never;

    await expect(controller.deleteSession(10, 99, user)).rejects.toThrow(NotFoundException);
  });
});
