import { Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Query } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/types/request-user';
import { ListBookReadingSessionsDto } from './dto/list-book-reading-sessions.dto';
import { ReadingSessionService } from './reading-session.service';

@Controller('books')
export class BookReadingSessionController {
  constructor(private readonly service: ReadingSessionService) {}

  @Get(':bookId/sessions')
  listSessions(@Param('bookId', ParseIntPipe) bookId: number, @Query() query: ListBookReadingSessionsDto, @CurrentUser() user: RequestUser) {
    return this.service.listByBook(bookId, user, query);
  }

  @Delete(':bookId/sessions/:sessionId')
  @HttpCode(204)
  async deleteSession(
    @Param('bookId', ParseIntPipe) bookId: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @CurrentUser() user: RequestUser,
  ) {
    await this.service.deleteSessionByBook(bookId, sessionId, user);
  }
}
