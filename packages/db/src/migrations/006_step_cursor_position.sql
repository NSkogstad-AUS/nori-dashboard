-- Captures the Playwright mouse target for Live view. Coordinates are viewport pixels and remain
-- nullable for actions that do not target a point, plus steps recorded before this migration.

alter table steps
  add column cursor_x integer,
  add column cursor_y integer,
  add constraint steps_cursor_x_nonnegative check (cursor_x is null or cursor_x >= 0),
  add constraint steps_cursor_y_nonnegative check (cursor_y is null or cursor_y >= 0);
