import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ThemePreferences } from '@bookorbit/types';

import { UserPreferencesRepository } from './user-preferences.repository';
import { UserPreferencesService } from './user-preferences.service';

const validThemePreferences: ThemePreferences = {
  theme: 'dark',
  accent: 'blue',
  radius: 'rounded',
  background: 'vinyl',
  brightness: 35,
};

const repo = {
  findByCategory: vi.fn<(...args: [number, string]) => Promise<{ data: ThemePreferences } | undefined>>(),
  upsert: vi.fn<(...args: [number, string, Record<string, unknown>]) => Promise<void>>(),
  delete: vi.fn<(...args: [number, string]) => Promise<void>>(),
};

describe('UserPreferencesService', () => {
  let service: UserPreferencesService;

  beforeEach(() => {
    vi.clearAllMocks();
    repo.findByCategory.mockResolvedValue(undefined);
    repo.upsert.mockResolvedValue(undefined);
    service = new UserPreferencesService(repo as unknown as UserPreferencesRepository);
  });

  it('getThemePreferences returns null when repository has no row', async () => {
    await expect(service.getThemePreferences(7)).resolves.toBeNull();
    expect(repo.findByCategory).toHaveBeenCalledWith(7, 'theme');
  });

  it('getThemePreferences returns saved theme settings when row exists', async () => {
    repo.findByCategory.mockResolvedValueOnce({ data: validThemePreferences });

    await expect(service.getThemePreferences(7)).resolves.toEqual(validThemePreferences);
  });

  it('upsertThemePreferences persists validated settings', async () => {
    await expect(service.upsertThemePreferences(11, validThemePreferences)).resolves.toBeUndefined();
    expect(repo.upsert).toHaveBeenCalledWith(11, 'theme', validThemePreferences);
  });

  it('upsertThemePreferences rejects invalid theme ids', async () => {
    await expect(service.upsertThemePreferences(11, { ...validThemePreferences, theme: 'sepia' } as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it('upsertThemePreferences rejects invalid accent ids', async () => {
    await expect(service.upsertThemePreferences(11, { ...validThemePreferences, accent: 'magenta' } as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it('upsertThemePreferences rejects invalid radius ids', async () => {
    await expect(service.upsertThemePreferences(11, { ...validThemePreferences, radius: 'soft' } as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it('upsertThemePreferences rejects invalid background ids', async () => {
    await expect(service.upsertThemePreferences(11, { ...validThemePreferences, background: 'stars' } as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it('upsertThemePreferences rejects brightness below zero', async () => {
    await expect(service.upsertThemePreferences(11, { ...validThemePreferences, brightness: -1 })).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it('upsertThemePreferences rejects brightness above one hundred', async () => {
    await expect(service.upsertThemePreferences(11, { ...validThemePreferences, brightness: 101 })).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it('upsertThemePreferences rejects extra unknown fields', async () => {
    await expect(
      service.upsertThemePreferences(11, { ...validThemePreferences, unexpected: true } as Record<string, unknown>),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it('upsertThemePreferences rejects payloads missing required fields', async () => {
    const { background, ...incomplete } = validThemePreferences;
    void background;

    await expect(service.upsertThemePreferences(11, incomplete)).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.upsert).not.toHaveBeenCalled();
  });
});
