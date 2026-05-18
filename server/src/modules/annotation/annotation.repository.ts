import { Inject, Injectable } from '@nestjs/common';
import { SQL, and, asc, count, countDistinct, desc, eq, gte, ilike, isNotNull, lte, inArray, or, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { DB } from '../../db';
import * as schema from '../../db/schema';
import { annotations, NewAnnotation } from '../../db/schema';

type Db = NodePgDatabase<typeof schema>;

export interface AnnotationFilters {
  colors?: string[];
  search?: string;
  chapter?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface AnnotationSort {
  by: 'position' | 'createdAt';
  dir: 'asc' | 'desc';
}

export interface PaginatedAnnotations {
  items: (typeof annotations.$inferSelect)[];
  total: number;
}

export interface AnnotationStatsResult {
  totalHighlights: number;
  colorBreakdown: { color: string; count: number }[];
  chaptersWithHighlights: number;
  highlightsWithNotes: number;
}

@Injectable()
export class AnnotationRepository {
  constructor(@Inject(DB) private readonly db: Db) {}

  async findByBookId(bookId: number, userId: number) {
    return this.db
      .select()
      .from(annotations)
      .where(and(eq(annotations.bookId, bookId), eq(annotations.userId, userId)))
      .orderBy(asc(annotations.createdAt));
  }

  async findPaginated(
    bookId: number,
    userId: number,
    filters: AnnotationFilters,
    sort: AnnotationSort,
    page: number,
    pageSize: number,
  ): Promise<PaginatedAnnotations> {
    const conditions = this.buildConditions(bookId, userId, filters);
    const orderBy = this.buildOrderBy(sort);
    const offset = (page - 1) * pageSize;

    const [items, totalResult] = await Promise.all([
      this.db
        .select()
        .from(annotations)
        .where(and(...conditions))
        .orderBy(...orderBy)
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(annotations)
        .where(and(...conditions)),
    ]);

    return { items, total: totalResult[0]?.count ?? 0 };
  }

  async getStats(bookId: number, userId: number, filters: AnnotationFilters): Promise<AnnotationStatsResult> {
    const conditions = this.buildConditions(bookId, userId, filters);

    const [aggregateResult, colorResult] = await Promise.all([
      this.db
        .select({
          totalHighlights: count(),
          chaptersWithHighlights: countDistinct(annotations.chapterTitle),
          highlightsWithNotes: count(sql`case when ${annotations.note} is not null and ${annotations.note} != '' then 1 end`),
        })
        .from(annotations)
        .where(and(...conditions)),
      this.db
        .select({
          color: annotations.color,
          count: count(),
        })
        .from(annotations)
        .where(and(...conditions))
        .groupBy(annotations.color)
        .orderBy(desc(count())),
    ]);

    const agg = aggregateResult[0];

    return {
      totalHighlights: agg?.totalHighlights ?? 0,
      chaptersWithHighlights: agg?.chaptersWithHighlights ?? 0,
      highlightsWithNotes: agg?.highlightsWithNotes ?? 0,
      colorBreakdown: colorResult.map((r) => ({ color: r.color, count: r.count })),
    };
  }

  async getDistinctChapters(bookId: number, userId: number): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ chapterTitle: annotations.chapterTitle })
      .from(annotations)
      .where(and(eq(annotations.bookId, bookId), eq(annotations.userId, userId), isNotNull(annotations.chapterTitle)))
      .orderBy(asc(annotations.chapterTitle));

    return rows.map((r) => r.chapterTitle).filter((t): t is string => t != null);
  }

  async create(data: NewAnnotation) {
    const [row] = await this.db.insert(annotations).values(data).returning();
    return row;
  }

  async update(bookId: number, annotationId: number, userId: number, data: Partial<Pick<NewAnnotation, 'note' | 'color' | 'style'>>) {
    const [row] = await this.db
      .update(annotations)
      .set({ ...data, updatedAt: sql`now()` })
      .where(and(eq(annotations.id, annotationId), eq(annotations.bookId, bookId), eq(annotations.userId, userId)))
      .returning();
    return row ?? null;
  }

  async delete(bookId: number, annotationId: number, userId: number) {
    const result = await this.db
      .delete(annotations)
      .where(and(eq(annotations.id, annotationId), eq(annotations.bookId, bookId), eq(annotations.userId, userId)))
      .returning({ id: annotations.id });
    return result.length > 0;
  }

  private buildConditions(bookId: number, userId: number, filters: AnnotationFilters): SQL[] {
    const conditions: SQL[] = [eq(annotations.bookId, bookId), eq(annotations.userId, userId)];

    if (filters.colors && filters.colors.length > 0) {
      conditions.push(inArray(annotations.color, filters.colors));
    }
    if (filters.search) {
      const pattern = `%${filters.search}%`;
      conditions.push(or(ilike(annotations.text, pattern), ilike(annotations.note, pattern))!);
    }
    if (filters.chapter) {
      conditions.push(eq(annotations.chapterTitle, filters.chapter));
    }
    if (filters.dateFrom) {
      conditions.push(gte(annotations.createdAt, filters.dateFrom));
    }
    if (filters.dateTo) {
      conditions.push(lte(annotations.createdAt, filters.dateTo));
    }

    return conditions;
  }

  private buildOrderBy(sort: AnnotationSort) {
    const direction = sort.dir === 'desc' ? desc : asc;
    if (sort.by === 'position') {
      return [direction(annotations.cfi), direction(annotations.id)];
    }
    return [direction(annotations.createdAt), direction(annotations.id)];
  }
}
