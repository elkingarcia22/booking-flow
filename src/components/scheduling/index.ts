// Agenda: la rejilla del día por recurso, la ocupación del mes y el selector de hora.
export { ResourceDayGrid, type ResourceDayGridProps } from "./ResourceDayGrid";
export { ScheduleEventCard, ScheduleColorDot, ScheduleMarkers, type ScheduleEventCardProps } from "./ScheduleEventCard";
export { MonthOccupancyGrid, type MonthOccupancyGridProps, type MonthOccupancyDay } from "./MonthOccupancyGrid";
export { TimeSlotPicker, type TimeSlotPickerProps } from "./TimeSlotPicker";
export { DayStrip, type DayStripProps } from "./DayStrip";
export { TimeSlotGroups, type TimeSlotGroupsProps, type TimeSlotGroup, type TimeSlotOption } from "./TimeSlotGroups";
export { ShiftWeekGrid, weekHours, type ShiftWeekGridProps, type ShiftRow, type ShiftDay } from "./ShiftWeekGrid";
export { useScheduleDrag, type DragPreview, type DragMode } from "./useScheduleDrag";
export type {
  ScheduleResource,
  ScheduleResourceAlert,
  ScheduleEvent,
  ScheduleEventKind,
  ScheduleTone,
  ScheduleFill,
  ScheduleEventAction,
  ScheduleEventGroup,
  ScheduleEventSegment,
  ScheduleMarker,
  ScheduleMarkerIcon,
  ScheduleDrop,
  ScheduleDropValidator,
  ScheduleSlot,
  ScheduleResourceAction,
  ScheduleWorkingHours,
} from "./scheduleTypes";
export {
  atMinutes,
  minutesOfDay,
  parseClock,
  snapMinutes,
  slotMinutes,
  isWorkingAt,
  workingMinutes,
  earliestWorkingMinute,
  eventMinutes,
  eventsForResource,
  rangesOverlap,
  occupiesSlot,
  findConflicts,
  layoutEvents,
  occupancyRate,
  nowPercent,
  formatClock,
  formatClockRange,
  initialsOf,
  SLOT_HEIGHT_PX,
  SCHEDULE_DENSITIES,
  SCHEDULE_COLOR_COUNT,
  SCHEDULE_COLUMN_MIN_PX,
  SCHEDULE_COLUMN_MAX_PX,
  clampColumnWidth,
  scheduleColorClass,
  type ScheduleDensity,
} from "./scheduleUtils";
