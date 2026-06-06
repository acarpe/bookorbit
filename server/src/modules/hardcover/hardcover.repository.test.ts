import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Permission } from '@bookorbit/types';

import { HardcoverRepository } from './hardcover.repository';

function makeReturningChain(row: unknown) {
  const chain = {
    values: vi.fn(),
    onConflictDoUpdate: vi.fn(),
    returning: vi.fn(),
  };
  chain.values.mockReturnValue(chain);
  chain.onConflictDoUpdate.mockReturnValue(chain);
  chain.returning.mockResolvedValue([row]);
  return chain;
}

function makeWhereChain(result: unknown) {
  return {
    where: vi.fn().mockResolvedValue(result),
  };
}

function makeRepository() {
  const settingsRow = { id: 1, userId: 7, apiToken: 'tok', enabled: true };
  const bookStateRow = { id: 2, userId: 7, bookId: 42, hardcoverBookId: 99 };

  const settingsQuery = { findFirst: vi.fn().mockResolvedValue(settingsRow) };
  const bookStateQuery = {
    findFirst: vi.fn().mockResolvedValue(bookStateRow),
    findMany: vi.fn().mockResolvedValue([bookStateRow]),
  };

  const settingsInsert = makeReturningChain(settingsRow);
  const bookStateInsert = makeReturningChain(bookStateRow);
  const deleteChain = makeWhereChain(undefined);
  const updateChain = { set: vi.fn().mockReturnValue(makeWhereChain(undefined)) };
  const bookIdLimit = vi.fn().mockResolvedValue([{ bookId: 42 }]);
  const bookIdWhere = vi.fn().mockReturnValue({ limit: bookIdLimit });
  const bookIdFrom = vi.fn().mockReturnValue({ where: bookIdWhere });
  const permissionLimit = vi.fn().mockResolvedValue([{ isSuperuser: false, permissionName: Permission.HardcoverSync }]);
  const permissionWhere = vi.fn().mockReturnValue({ limit: permissionLimit });
  const permissionLeftJoin = vi.fn().mockReturnValue({ where: permissionWhere });
  const permissionFrom = vi.fn().mockReturnValue({ leftJoin: permissionLeftJoin });

  const db = {
    query: {
      hardcoverUserSettings: settingsQuery,
      hardcoverBookState: bookStateQuery,
    },
    insert: vi.fn().mockReturnValueOnce(settingsInsert).mockReturnValueOnce(bookStateInsert),
    delete: vi.fn().mockReturnValue(deleteChain),
    update: vi.fn().mockReturnValue(updateChain),
    select: vi.fn().mockReturnValue({ from: bookIdFrom }),
  };

  return {
    repo: new HardcoverRepository(db as never),
    db,
    settingsQuery,
    bookStateQuery,
    settingsInsert,
    bookStateInsert,
    deleteChain,
    updateChain,
    bookIdLimit,
    bookIdWhere,
    permissionLimit,
    permissionFrom,
    settingsRow,
    bookStateRow,
  };
}

describe('HardcoverRepository', () => {
  beforeEach(() => vi.clearAllMocks());

  it('findSettings returns the user settings row', async () => {
    const { repo, settingsQuery, settingsRow } = makeRepository();

    await expect(repo.findSettings(7)).resolves.toEqual(settingsRow);
    expect(settingsQuery.findFirst).toHaveBeenCalledTimes(1);
  });

  it('upsertSettings inserts or updates settings for a user', async () => {
    const { repo, db, settingsInsert, settingsRow } = makeRepository();
    db.insert.mockReset();
    db.insert.mockReturnValue(settingsInsert);

    await expect(repo.upsertSettings(7, { apiToken: 'tok' })).resolves.toEqual(settingsRow);
    expect(settingsInsert.values).toHaveBeenCalledWith({ userId: 7, apiToken: 'tok' });
    expect(settingsInsert.onConflictDoUpdate).toHaveBeenCalledWith(expect.objectContaining({ set: expect.objectContaining({ apiToken: 'tok' }) }));
  });

  it('deleteSettings deletes settings for a user', async () => {
    const { repo, deleteChain } = makeRepository();

    await repo.deleteSettings(7);

    expect(deleteChain.where).toHaveBeenCalledTimes(1);
  });

  it('findBookState returns one book state row', async () => {
    const { repo, bookStateQuery, bookStateRow } = makeRepository();

    await expect(repo.findBookState(7, 42)).resolves.toEqual(bookStateRow);
    expect(bookStateQuery.findFirst).toHaveBeenCalledTimes(1);
  });

  it('findBookStatesByBookIds short-circuits for an empty list', async () => {
    const { repo, bookStateQuery } = makeRepository();

    await expect(repo.findBookStatesByBookIds(7, [])).resolves.toEqual([]);
    expect(bookStateQuery.findMany).not.toHaveBeenCalled();
  });

  it('findBookStatesByBookIds returns matching state rows', async () => {
    const { repo, bookStateQuery, bookStateRow } = makeRepository();

    await expect(repo.findBookStatesByBookIds(7, [42])).resolves.toEqual([bookStateRow]);
    expect(bookStateQuery.findMany).toHaveBeenCalledTimes(1);
  });

  it('upsertBookState inserts or updates per-book state', async () => {
    const { repo, db, bookStateInsert, bookStateRow } = makeRepository();
    db.insert.mockReset();
    db.insert.mockReturnValue(bookStateInsert);

    await expect(repo.upsertBookState({ userId: 7, bookId: 42, hardcoverBookId: 99 })).resolves.toEqual(bookStateRow);
    expect(bookStateInsert.values).toHaveBeenCalledWith({ userId: 7, bookId: 42, hardcoverBookId: 99 });
    expect(bookStateInsert.onConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ set: expect.objectContaining({ hardcoverBookId: 99 }) }),
    );
  });

  it('updateLastSyncedAt updates the settings timestamp', async () => {
    const { repo, updateChain } = makeRepository();
    const syncedAt = new Date('2026-01-01T00:00:00Z');

    await repo.updateLastSyncedAt(7, syncedAt);

    expect(updateChain.set).toHaveBeenCalledWith({ lastSyncedAt: syncedAt });
  });

  it('findSyncableBook returns a book from findSyncableBooks', async () => {
    const { repo } = makeRepository();
    const findSyncableBooksForUser = vi.spyOn(repo as any, 'findSyncableBooksForUser');
    findSyncableBooksForUser.mockResolvedValueOnce([{ bookId: 42 }]).mockResolvedValueOnce([]);

    await expect(repo.findSyncableBook(7, 42)).resolves.toEqual({ bookId: 42 });
    await expect(repo.findSyncableBook(7, 99)).resolves.toBeNull();
    expect(findSyncableBooksForUser).toHaveBeenNthCalledWith(1, 7, 42);
    expect(findSyncableBooksForUser).toHaveBeenNthCalledWith(2, 7, 99);
  });

  it('findBookIdByFileId returns the first matching book id', async () => {
    const { repo, bookIdLimit, bookIdWhere } = makeRepository();

    await expect(repo.findBookIdByFileId(5)).resolves.toBe(42);
    expect(bookIdLimit).toHaveBeenCalledWith(1);
    expect(bookIdWhere).toHaveBeenCalledTimes(1);
  });

  it('userHasHardcoverSyncPermission returns true for a user with the permission', async () => {
    const { repo, db, permissionFrom } = makeRepository();
    db.select.mockReturnValueOnce({ from: permissionFrom });

    await expect(repo.userHasHardcoverSyncPermission(7)).resolves.toBe(true);
  });

  it('userHasHardcoverSyncPermission returns true for a superuser', async () => {
    const { repo, db, permissionFrom, permissionLimit } = makeRepository();
    permissionLimit.mockResolvedValueOnce([{ isSuperuser: true, permissionName: null }]);
    db.select.mockReturnValueOnce({ from: permissionFrom });

    await expect(repo.userHasHardcoverSyncPermission(7)).resolves.toBe(true);
  });

  it('userHasHardcoverSyncPermission returns false without an active matching user permission row', async () => {
    const { repo, db, permissionFrom, permissionLimit } = makeRepository();
    permissionLimit.mockResolvedValueOnce([{ isSuperuser: false, permissionName: null }]);
    db.select.mockReturnValueOnce({ from: permissionFrom });

    await expect(repo.userHasHardcoverSyncPermission(7)).resolves.toBe(false);
  });
});
