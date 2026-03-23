import { format, parseISO } from "date-fns";
import { MapPin, Clock, Ticket, Users, ExternalLink, CheckCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { 
  type ShowWithDetails, 
  useMarkAttending, 
  useRemoveAttendance,
  getListShowsQueryKey,
  getGetFriendsActivityQueryKey
} from "@workspace/api-client-react";

interface ShowCardProps {
  show: ShowWithDetails;
}

export function ShowCard({ show }: ShowCardProps) {
  const queryClient = useQueryClient();
  const { mutate: markAttending, isPending: isMarking } = useMarkAttending();
  const { mutate: removeAttendance, isPending: isRemoving } = useRemoveAttendance();

  const isPending = isMarking || isRemoving;
  const dateObj = parseISO(show.showDate);

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: getListShowsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetFriendsActivityQueryKey() });
  };

  const toggleAttendance = () => {
    if (show.currentUserAttending) {
      removeAttendance({ id: show.id }, { onSuccess: invalidateQueries });
    } else {
      markAttending({ id: show.id, data: { boughtTickets: false } }, { onSuccess: invalidateQueries });
    }
  };

  const toggleTickets = () => {
    if (!show.currentUserAttending) {
      markAttending({ id: show.id, data: { boughtTickets: true } }, { onSuccess: invalidateQueries });
    } else {
      markAttending({ id: show.id, data: { boughtTickets: !show.currentUserBoughtTickets } }, { onSuccess: invalidateQueries });
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative flex flex-col sm:flex-row bg-card rounded-2xl overflow-hidden border border-border/50 hover:border-primary/50 transition-all duration-500 shadow-lg hover:shadow-[0_0_30px_rgba(255,0,127,0.15)]"
    >
      {/* Date Block (Ticket Stub style left edge) */}
      <div className="bg-gradient-to-b from-muted/50 to-transparent sm:w-32 p-6 flex flex-row sm:flex-col items-center justify-center border-b sm:border-b-0 sm:border-r border-border/50 border-dashed relative">
        {/* Stub cutouts */}
        <div className="hidden sm:block absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-8 bg-background rounded-r-full border-r border-border/50" />
        <div className="hidden sm:block absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-8 bg-background rounded-l-full border-l border-border/50 z-10" />
        
        <div className="text-primary font-display text-xl sm:text-2xl leading-none">{format(dateObj, "MMM")}</div>
        <div className="text-foreground font-display text-4xl sm:text-6xl leading-none ml-3 sm:ml-0 mt-0 sm:mt-1">{format(dateObj, "dd")}</div>
        <div className="text-muted-foreground font-semibold text-sm tracking-widest mt-0 sm:mt-2 ml-auto sm:ml-0">{format(dateObj, "EEEE")}</div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-start gap-4">
            <div>
              {show.artist && (
                <div className="text-secondary font-display tracking-widest text-sm mb-1">{show.artist}</div>
              )}
              <h3 className="text-2xl font-display text-foreground leading-tight">{show.title}</h3>
            </div>
            
            {show.ticketPrice && (
              <div className="bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full font-bold text-sm whitespace-nowrap">
                {show.ticketPrice}
              </div>
            )}
          </div>

          <div className="mt-4 space-y-2 text-sm text-muted-foreground font-medium">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              <span className="text-foreground/80">{show.venue.name}</span>
              <span className="opacity-50">• {show.venue.city}</span>
            </div>
            {(show.doorsTime || show.showTime) && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-secondary" />
                <span>
                  {show.doorsTime && `Doors: ${show.doorsTime}`}
                  {show.doorsTime && show.showTime && ' | '}
                  {show.showTime && `Show: ${show.showTime}`}
                </span>
              </div>
            )}
          </div>

          {/* Friends Attending Avatars */}
          {show.friendsAttending && show.friendsAttending.length > 0 && (
            <div className="mt-4 flex items-center gap-3 bg-white/5 rounded-xl p-2 border border-white/5 w-fit">
              <div className="flex -space-x-2">
                {show.friendsAttending.slice(0, 3).map(f => (
                  <div key={f.userId} className="w-8 h-8 rounded-full border-2 border-card bg-muted flex items-center justify-center overflow-hidden" title={f.displayName || f.username}>
                    {f.profileImageUrl ? (
                      <img src={f.profileImageUrl} alt={f.username} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold text-white">{f.username.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                ))}
              </div>
              <span className="text-xs font-semibold text-muted-foreground pr-2">
                {show.friendsAttending.length} friend{show.friendsAttending.length > 1 ? 's' : ''} going
              </span>
            </div>
          )}
        </div>

        {/* Action Bar */}
        <div className="mt-6 pt-4 border-t border-border/50 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleAttendance}
              disabled={isPending}
              className={`
                px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all duration-300
                ${show.currentUserAttending 
                  ? 'bg-primary text-white shadow-[0_0_15px_rgba(255,0,127,0.4)]' 
                  : 'bg-white/5 text-foreground hover:bg-white/10 border border-white/10'}
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              <Users className="w-4 h-4" />
              {show.currentUserAttending ? "I'm Going!" : "Going?"}
            </button>
            
            {show.currentUserAttending && (
              <button
                onClick={toggleTickets}
                disabled={isPending}
                className={`
                  px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all duration-300
                  ${show.currentUserBoughtTickets 
                    ? 'bg-secondary text-black shadow-[0_0_15px_rgba(0,240,255,0.4)]' 
                    : 'bg-white/5 text-foreground hover:bg-white/10 border border-white/10'}
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                {show.currentUserBoughtTickets ? <CheckCircle className="w-4 h-4" /> : <Ticket className="w-4 h-4" />}
                {show.currentUserBoughtTickets ? "Got Tickets" : "Have Tickets?"}
              </button>
            )}
          </div>

          <div className="flex items-center gap-4 text-sm font-semibold text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" /> {show.attendeeCount}
            </span>
            {show.ticketUrl && (
              <a 
                href={show.ticketUrl} 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center gap-1 text-secondary hover:text-primary transition-colors"
              >
                Get Tickets <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
