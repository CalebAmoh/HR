import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Info } from 'lucide-react';

const mockLeaves = [
  { id: 1, employee: 'SAMUEL BANDOH', type: 'Annual leave', startDate: '2026-05-07', endDate: '2026-05-09', status: 'Approved' },
  { id: 2, employee: 'UNION ADMIN', type: 'Annual leave', startDate: '2026-05-15', endDate: '2026-05-15', status: 'Pending' },
  { id: 3, employee: 'SARAH JENKS', type: 'Casual leave', startDate: '2026-05-02', endDate: '2026-05-05', status: 'Past' },
  { id: 4, employee: 'MICHAEL CHEN', type: 'Business Leave', startDate: '2026-05-20', endDate: '2026-05-22', status: 'Approved' },
  { id: 5, employee: 'UNION ADMIN', type: 'Maternity Leave', startDate: '2026-05-25', endDate: '2026-05-30', status: 'Pending' },
];

const mockHolidays = [
  { id: 1, name: 'New Year', date: '2026-01-01' },
  { id: 2, name: 'Labor Day', date: '2026-05-01' },
  { id: 3, name: 'Christmas Day', date: '2026-12-25' }
];

type ViewMode = 'month' | 'week' | 'day';

export function LeaveCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date('2026-05-01')); // Default to May 2026 to match mock data
  const [viewMode, setViewMode] = useState<ViewMode>('month');

  const handlePrev = () => {
    const nextDate = new Date(currentDate);
    if (viewMode === 'month') nextDate.setMonth(currentDate.getMonth() - 1);
    else if (viewMode === 'week') nextDate.setDate(currentDate.getDate() - 7);
    else if (viewMode === 'day') nextDate.setDate(currentDate.getDate() - 1);
    setCurrentDate(nextDate);
  };

  const handleNext = () => {
    const nextDate = new Date(currentDate);
    if (viewMode === 'month') nextDate.setMonth(currentDate.getMonth() + 1);
    else if (viewMode === 'week') nextDate.setDate(currentDate.getDate() + 7);
    else if (viewMode === 'day') nextDate.setDate(currentDate.getDate() + 1);
    setCurrentDate(nextDate);
  };

  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const year = currentDate.getFullYear();

  const getLeavesForDate = (dateStr: string) => {
    return mockLeaves.filter(leave => {
      return dateStr >= leave.startDate && dateStr <= leave.endDate;
    });
  };

  const getHolidayForDate = (dateStr: string) => {
    return mockHolidays.find(h => h.date === dateStr);
  };

  // Month View Calculations
  const daysInMonth = new Date(year, currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, currentDate.getMonth(), 1).getDay();
  const monthDays = [];
  for (let i = 0; i < firstDayOfMonth; i++) monthDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) monthDays.push(i);

  // Week View Calculations
  const currentDayOfWeek = currentDate.getDay();
  const startOfWeek = new Date(currentDate);
  startOfWeek.setDate(currentDate.getDate() - currentDayOfWeek);
  const weekDays = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return d;
  });

  const formatDateStr = (d: Date) => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const renderTitle = () => {
    if (viewMode === 'month') return `${monthName} ${year}`;
    if (viewMode === 'week') {
      const start = weekDays[0];
      const end = weekDays[6];
      if (start.getMonth() === end.getMonth()) {
        return `${start.toLocaleString('default', { month: 'short' })} ${start.getDate()} - ${end.getDate()}, ${year}`;
      }
      return `${start.toLocaleString('default', { month: 'short' })} ${start.getDate()} - ${end.toLocaleString('default', { month: 'short' })} ${end.getDate()}, ${year}`;
    }
    return `${currentDate.toLocaleString('default', { weekday: 'long' })}, ${monthName} ${currentDate.getDate()}, ${year}`;
  };

  return (
    <div className="p-4 sm:p-6 w-full max-w-[1400px] mx-auto overflow-x-hidden flex flex-col h-full relative">
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-[22px] font-bold syne text-[var(--text-primary)] tracking-tight">Leave Calendar</h2>
          <p className="text-xs sm:text-[13px] text-[var(--text-muted)] font-medium mt-1">View employee leave schedules across the organization.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center bg-slate-100 p-1 rounded-lg">
            {(['month', 'week', 'day'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 text-xs font-bold rounded-md capitalize transition-colors ${
                  viewMode === mode ? 'bg-white text-[var(--accent)] shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-100 border border-emerald-300"></span>
              <span className="text-xs font-medium text-slate-600">Approved</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-100 border border-amber-300"></span>
              <span className="text-xs font-medium text-slate-600">Pending</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-slate-200 border border-slate-300"></span>
              <span className="text-xs font-medium text-slate-600">Past</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[16px] overflow-hidden flex flex-col flex-1 min-h-[600px]">
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2 text-slate-700 font-bold text-lg syne">
            <CalendarIcon size={20} className="text-[var(--accent)]" /> 
            {renderTitle()}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrev} className="p-1.5 border border-slate-200 rounded hover:bg-slate-100 transition-colors">
              <ChevronLeft size={18} />
            </button>
            <button onClick={handleNext} className="p-1.5 border border-slate-200 rounded hover:bg-slate-100 transition-colors">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {viewMode === 'month' && (
          <>
            <div className="grid grid-cols-7 border-b border-[var(--border)] bg-slate-100">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="py-2 text-center text-xs font-bold text-slate-500 uppercase tracking-widest border-r border-[var(--border)] last:border-0">{day}</div>
              ))}
            </div>
            <div className="flex-1 grid grid-cols-7 auto-rows-fr bg-[var(--border)] gap-px overflow-y-auto">
              {monthDays.map((day, index) => {
                if (day === null) {
                  return <div key={`empty-${index}`} className="bg-slate-50 min-h-[100px]"></div>;
                }
                const dateStr = formatDateStr(new Date(year, currentDate.getMonth(), day));
                const dateLeaves = getLeavesForDate(dateStr);
                const holiday = getHolidayForDate(dateStr);
                return (
                  <div key={`day-${day}`} className="bg-white min-h-[100px] p-2 hover:bg-slate-50 transition-colors flex flex-col">
                    <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full mb-1 ${holiday ? 'bg-red-50 text-red-600' : dateLeaves.length > 0 ? 'bg-indigo-50 text-indigo-700' : 'text-slate-400'}`}>
                      {day}
                    </span>
                    <div className="flex flex-col gap-1 overflow-y-auto flex-1 custom-scrollbar pr-1">
                      {holiday && (
                        <div className="text-[10px] px-2 py-1 rounded border leading-tight truncate bg-red-50 text-red-700 border-red-200" title={holiday.name}>
                          <strong className="block truncate">🌟 {holiday.name}</strong>
                          <span className="opacity-80 truncate">Holiday</span>
                        </div>
                      )}
                      {dateLeaves.map(leave => (
                        <div 
                          key={leave.id} 
                          className={`text-[10px] px-2 py-1 rounded border leading-tight truncate
                            ${leave.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                              leave.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                              'bg-slate-100 text-slate-600 border-slate-200'}
                          `}
                          title={`${leave.employee} - ${leave.type} (${leave.status})`}
                        >
                          <strong className="block truncate">{leave.employee}</strong>
                          <span className="opacity-80 truncate">{leave.type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {viewMode === 'week' && (
          <div className="flex-1 flex flex-col overflow-y-auto bg-slate-50">
            <div className="grid grid-cols-7 border-b border-slate-200 bg-white sticky top-0 z-10 shadow-sm">
              {weekDays.map((date, i) => (
                <div key={i} className="py-3 text-center border-r border-slate-200 last:border-0">
                  <div className="text-xs font-bold text-slate-500 uppercase">{date.toLocaleString('default', { weekday: 'short' })}</div>
                  <div className={`text-lg font-bold mt-0.5 ${formatDateStr(date) === formatDateStr(new Date()) ? 'bg-indigo-600 text-white w-8 h-8 flex items-center justify-center rounded-full mx-auto' : 'text-slate-800'}`}>
                    {date.getDate()}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex-1 grid grid-cols-7 bg-[var(--border)] gap-px p-4">
              {weekDays.map((date, i) => {
                const dateStr = formatDateStr(date);
                const dateLeaves = getLeavesForDate(dateStr);
                const holiday = getHolidayForDate(dateStr);
                return (
                  <div key={i} className={`rounded-lg p-2 min-h-[400px] shadow-sm flex flex-col gap-2 ${holiday ? 'bg-red-50/20' : 'bg-white'}`}>
                    {dateLeaves.length === 0 && !holiday && (
                      <div className="flex items-center justify-center h-full text-xs text-slate-400 font-medium">No leaves</div>
                    )}
                    {holiday && (
                      <div className="text-xs p-3 rounded-lg border flex flex-col gap-1 bg-red-50 text-red-800 border-red-200 shadow-sm">
                        <strong className="block flex items-center gap-1.5"><span className="text-red-500">🌟</span> {holiday.name}</strong>
                        <span className="opacity-80">Holiday</span>
                      </div>
                    )}
                    {dateLeaves.map(leave => (
                      <div 
                        key={leave.id} 
                        className={`text-xs p-3 rounded-lg border flex flex-col gap-1
                          ${leave.status === 'Approved' ? 'bg-emerald-50/50 text-emerald-800 border-emerald-200' : 
                            leave.status === 'Pending' ? 'bg-amber-50/50 text-amber-800 border-amber-200' : 
                            'bg-slate-50 text-slate-700 border-slate-200'}
                        `}
                      >
                        <strong className="block">{leave.employee}</strong>
                        <span className="opacity-80">{leave.type}</span>
                        <div className="mt-1 pt-1 border-t border-black/5 text-[10px] font-medium opacity-70">
                          {leave.startDate === leave.endDate ? 'Full Day' : `${leave.startDate} to ${leave.endDate}`}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {viewMode === 'day' && (
          <div className="flex-1 flex flex-col overflow-y-auto bg-slate-50 p-6">
            <div className="max-w-3xl mx-auto w-full flex flex-col gap-4">
              {(() => {
                const dateStr = formatDateStr(currentDate);
                const dateLeaves = getLeavesForDate(dateStr);
                const holiday = getHolidayForDate(dateStr);
                
                if (dateLeaves.length === 0 && !holiday) {
                  return (
                    <div className="bg-white rounded-xl border border-slate-200 p-12 flex flex-col items-center justify-center text-center">
                      <CalendarIcon size={48} className="text-slate-300 mb-4" />
                      <h3 className="text-lg font-bold text-slate-700 syne">No Leaves Today</h3>
                      <p className="text-slate-500 mt-1 text-sm">There are no approved or pending leaves scheduled for this date.</p>
                    </div>
                  );
                }

                return (
                  <>
                    {holiday && (
                      <div className="bg-white rounded-xl p-5 border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-red-200 hover:border-red-300">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold bg-red-100 text-red-600">
                            🌟
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-800 text-base">{holiday.name}</h4>
                            <p className="text-slate-500 text-sm font-medium">Holiday</p>
                          </div>
                        </div>
                        <div className="flex flex-col sm:items-end gap-1 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                          <span className="text-xs px-2.5 py-1 rounded-full font-bold self-start sm:self-auto bg-red-50 text-red-700 border border-red-100">
                            Public Holiday
                          </span>
                        </div>
                      </div>
                    )}
                    {dateLeaves.map(leave => (
                      <div 
                        key={leave.id} 
                        className={`bg-white rounded-xl p-5 border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4
                          ${leave.status === 'Approved' ? 'border-emerald-200 hover:border-emerald-300' : 
                            leave.status === 'Pending' ? 'border-amber-200 hover:border-amber-300' : 
                            'border-slate-200 hover:border-slate-300'}
                        `}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold
                            ${leave.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' : 
                              leave.status === 'Pending' ? 'bg-amber-100 text-amber-700' : 
                              'bg-slate-100 text-slate-600'}
                          `}>
                            {leave.employee.substring(0, 2)}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-800 text-base">{leave.employee}</h4>
                            <p className="text-slate-500 text-sm font-medium">{leave.type}</p>
                          </div>
                        </div>
                        
                        <div className="flex flex-col sm:items-end gap-1 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-bold self-start sm:self-auto
                            ${leave.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' : 
                              leave.status === 'Pending' ? 'bg-amber-100 text-amber-700' : 
                              'bg-slate-100 text-slate-600'}
                          `}>
                            {leave.status}
                          </span>
                          <span className="text-xs text-slate-400 font-medium">
                            {leave.startDate === leave.endDate ? 'Full Day' : `${leave.startDate} → ${leave.endDate}`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
