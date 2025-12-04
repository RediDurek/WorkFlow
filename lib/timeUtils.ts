'use client';

import { LogType, TimeAdjustment, TimeLog } from '../types';

// Parse an HH:mm (or H:mm) time string on a given date into a timestamp.
export const parseTimeOnDate = (dateStr: string, timeStr?: string | null): number | null => {
  if (!timeStr) return null;
  const normalized = timeStr.includes(':') ? timeStr.slice(0, 5) : timeStr;
  const d = new Date(`${dateStr}T${normalized}`);
  const ts = d.getTime();
  return isNaN(ts) ? null : ts;
};

// Compute net milliseconds from explicit times (ingressi/uscite + pausa opzionale).
export const computeNetMs = (dateStr: string, clockIn?: string, clockOut?: string, pauseStart?: string, pauseEnd?: string): number | null => {
  const startTs = parseTimeOnDate(dateStr, clockIn);
  const endTs = parseTimeOnDate(dateStr, clockOut);
  const pauseStartTs = parseTimeOnDate(dateStr, pauseStart);
  const pauseEndTs = parseTimeOnDate(dateStr, pauseEnd);
  if (startTs === null || endTs === null || endTs <= startTs) return null;
  let duration = endTs - startTs;
  if (pauseStartTs !== null && pauseEndTs !== null && pauseEndTs > pauseStartTs && pauseStartTs > startTs && pauseEndTs < endTs) {
    duration -= (pauseEndTs - pauseStartTs);
  }
  return duration;
};

export const computeNetHours = (dateStr: string, clockIn?: string, clockOut?: string, pauseStart?: string, pauseEnd?: string): number | null => {
  const ms = computeNetMs(dateStr, clockIn, clockOut, pauseStart, pauseEnd);
  if (ms === null) return null;
  return ms / (1000 * 60 * 60);
};

// Merge logs with approved adjustments: for each approved adjustment replace that day's logs with corrected ones (including pause).
export const mergeLogsWithAdjustments = (logs: TimeLog[], adjustments: TimeAdjustment[]): TimeLog[] => {
  // Only approved adjustments should affect time logs (pending/rejected must be ignored)
  const approvedAdj = adjustments.filter(a => a.status === 'APPROVED');
  let mergedLogs = [...logs];

  approvedAdj.forEach(adj => {
    const startTs = parseTimeOnDate(adj.date, adj.clockInNew || adj.clockIn);
    const endTs = parseTimeOnDate(adj.date, adj.clockOutNew || adj.clockOut);
    const pauseStartTs = parseTimeOnDate(adj.date, adj.pauseStartNew || adj.pauseStart);
    const pauseEndTs = parseTimeOnDate(adj.date, adj.pauseEndNew || adj.pauseEnd);
    if (startTs !== null && endTs !== null && endTs > startTs) {
      mergedLogs = mergedLogs.filter(l => !(l.userId === adj.userId && l.dateString === adj.date));
      mergedLogs.push({
        id: `adj-${adj.id}-in`,
        userId: adj.userId,
        orgId: adj.orgId,
        timestamp: startTs,
        type: LogType.CLOCK_IN,
        dateString: adj.date
      });
      if (pauseStartTs !== null && pauseEndTs !== null && pauseEndTs > pauseStartTs && pauseStartTs > startTs && pauseEndTs < endTs) {
        mergedLogs.push({
          id: `adj-${adj.id}-pstart`,
          userId: adj.userId,
          orgId: adj.orgId,
          timestamp: pauseStartTs,
          type: LogType.START_BREAK,
          dateString: adj.date
        });
        mergedLogs.push({
          id: `adj-${adj.id}-pend`,
          userId: adj.userId,
          orgId: adj.orgId,
          timestamp: pauseEndTs,
          type: LogType.END_BREAK,
          dateString: adj.date
        });
      }
      mergedLogs.push({
        id: `adj-${adj.id}-out`,
        userId: adj.userId,
        orgId: adj.orgId,
        timestamp: endTs,
        type: LogType.CLOCK_OUT,
        dateString: adj.date
      });
    }
  });

  return mergedLogs.sort((a, b) => a.timestamp - b.timestamp);
};

// Build day aggregates (net of breaks) from logs already merged/normalized.
export const buildDayAggregates = (logs: TimeLog[]): Map<string, { totalMs: number; segments: { start: number; end: number }[] }> => {
  const dayMap = new Map<string, { totalMs: number; segments: { start: number; end: number }[] }>();
  const sorted = [...logs].sort((a, b) => a.timestamp - b.timestamp);
  sorted.forEach(l => {
    const dk = l.dateString || new Date(l.timestamp).toISOString().split('T')[0];
    if (!dayMap.has(dk)) dayMap.set(dk, { totalMs: 0, segments: [] });
  });

  let open: number | null = null;
  let openDate = '';
  const close = (endTs: number) => {
    if (open !== null && openDate) {
      const entry = dayMap.get(openDate);
      if (entry) {
        entry.totalMs += endTs - open;
        entry.segments.push({ start: open, end: endTs });
      }
      open = null;
      openDate = '';
    }
  };

  sorted.forEach(l => {
    const dk = l.dateString || new Date(l.timestamp).toISOString().split('T')[0];
    if (l.type === LogType.CLOCK_IN || l.type === LogType.END_BREAK) { open = l.timestamp; openDate = dk; }
    if ((l.type === LogType.START_BREAK || l.type === LogType.CLOCK_OUT) && open !== null) { close(l.timestamp); }
  });

  if (open !== null && openDate) {
    const endOfDay = new Date(`${openDate}T23:59:59`).getTime();
    close(endOfDay);
  }

  return dayMap;
};
