import { useState, useMemo } from "react";
import { useListShows } from "@workspace/api-client-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { motion } from "framer-motion";

export function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // We fetch shows for the current month view +/- some padding
  const startDateStr = format(startOfMonth(currentDate), "yyyy-MM-dd");
  const endDateStr = format(endOfMonth(currentDate), "yyyy-MM-dd");

  const { data: shows, isLoading } = useListShows({
    startDate: startDateStr,
    endDate: endDateStr
  });

  const daysInMonth = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="text-5xl font-display tracking-wide text-foreground mb-2">Show <span className="text-accent">Calendar</span></h1>
          <p className="text-muted-foreground font-medium">Month at a glance.</p>
        </div>

        <div className="flex items-center gap-4 bg-card border border-border/50 rounded-xl p-2 shadow-lg w-fit">
          <button onClick={prevMonth} className="p-2 hover:bg-white/10 rounded-lg transition-colors"><ChevronLeft className="w-5 h-5" /></button>
          <div className="font-display text-2xl px-4 min-w-[150px] text-center">{format(currentDate, "MMMM yyyy")}</div>
          <button onClick={nextMonth} className="p-2 hover:bg-white/10 rounded-lg transition-colors"><ChevronRight className="w-5 h-5" /></button>
        </div>
      </div>

      <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-lg">
        {/* Days Header */}
        <div className="grid grid-cols-7 border-b border-border/50 bg-white/5">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="py-4 text-center text-xs font-bold text-muted-foreground uppercase tracking-widest border-r border-border/50 last:border-r-0">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 auto-rows-fr">
          {/* Empty cells for padding start of month */}
          {Array.from({ length: startOfMonth(currentDate).getDay() }).map((_, i) => (
            <div key={`empty-start-${i}`} className="min-h-[120px] p-2 border-r border-b border-border/50 bg-background/50" />
          ))}

          {/* Actual days */}
          {daysInMonth.map((day, idx) => {
            const dayShows = shows?.filter(show => show.showDate.startsWith(format(day, "yyyy-MM-dd"))) || [];
            const isToday = isSameDay(day, new Date());
            
            return (
              <div 
                key={day.toISOString()} 
                className={`min-h-[120px] p-2 border-r border-b border-border/50 transition-colors hover:bg-white/5 relative ${isToday ? 'bg-primary/5' : ''}`}
              >
                <div className={`text-right font-display text-2xl mb-2 ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                  {format(day, "d")}
                </div>
                
                <div className="space-y-1">
                  {dayShows.map(show => (
                    <motion.div 
                      key={show.id} 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`text-xs p-1.5 rounded border truncate cursor-pointer font-bold ${
                        show.currentUserAttending 
                          ? 'bg-primary/20 border-primary text-primary-foreground shadow-[0_0_10px_rgba(255,0,127,0.2)]' 
                          : 'bg-white/5 border-white/10 text-foreground/80'
                      }`}
                      title={`${show.title} @ ${show.venue.name}`}
                    >
                      {show.title}
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Empty cells for padding end of month */}
          {Array.from({ length: 6 - endOfMonth(currentDate).getDay() }).map((_, i) => (
            <div key={`empty-end-${i}`} className="min-h-[120px] p-2 border-r border-b border-border/50 bg-background/50" />
          ))}
        </div>
      </div>
    </div>
  );
}
