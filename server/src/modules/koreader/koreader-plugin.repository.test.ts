import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sqlChunkText } from '../../common/test-utils/sql-chunk-text';
import { KoreaderPluginRepository } from './koreader-plugin.repository';

function makeQueryChain(result: unknown) {
  const chain: Record<string, unknown> = {
    then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
      return Promise.resolve(result).then(resolve, reject);
    },
  };
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  return chain;
}

function makeDb() {
  return {
    execute: vi.fn(),
    select: vi.fn(),
  };
}

describe('KoreaderPluginRepository', () => {
  let db: ReturnType<typeof makeDb>;
  let repo: KoreaderPluginRepository;

  beforeEach(() => {
    db = makeDb();
    repo = new KoreaderPluginRepository(db as never);
  });

  describe('getPluginTotals', () => {
    it('maps aggregate counts including linkable unmatched books', async () => {
      db.execute.mockResolvedValue({
        rows: [
          {
            matched_books: '2',
            page_stat_events: '10',
            annotations: '4',
            trashed_annotations: '1',
            pending_deletes: '3',
            failed_positions: '5',
            unmatched_books: '6',
          },
        ],
      });

      await expect(repo.getPluginTotals(7)).resolves.toEqual({
        matchedBooks: 2,
        pageStatEvents: 10,
        annotations: 4,
        trashedAnnotations: 1,
        pendingDeletes: 3,
        failedPositions: 5,
        unmatchedBooks: 6,
      });

      const sqlText = sqlChunkText(db.execute.mock.calls[0]![0]).replace(/\s+/g, ' ');
      expect(sqlText).toContain('from koreader_unmatched_books');
      expect(sqlText).toContain("source in ('current_file', 'file')");
      expect(sqlText).toContain('metadata_ambiguous = false');
    });

    it('defaults missing aggregate rows to zeroes', async () => {
      db.execute.mockResolvedValue({ rows: [] });

      await expect(repo.getPluginTotals(7)).resolves.toEqual({
        matchedBooks: 0,
        pageStatEvents: 0,
        annotations: 0,
        trashedAnnotations: 0,
        pendingDeletes: 0,
        failedPositions: 0,
        unmatchedBooks: 0,
      });
    });
  });

  describe('getHashLinkVersion', () => {
    it('returns manual link count and newest update timestamp', async () => {
      db.select.mockReturnValue(makeQueryChain([{ count: '3', maxTs: '2026-06-02T10:00:00.000Z' }]));

      await expect(repo.getHashLinkVersion(7)).resolves.toEqual({
        count: 3,
        maxTs: new Date('2026-06-02T10:00:00.000Z'),
      });
    });

    it('returns an empty version when no link rows exist', async () => {
      db.select.mockReturnValue(makeQueryChain([]));

      await expect(repo.getHashLinkVersion(7)).resolves.toEqual({ count: 0, maxTs: null });
    });
  });
});
