import { useState } from "react";
import { 
  useListFriends, 
  useGetFriendsActivity, 
  useListFriendRequests,
  useSearchUsers,
  useSendFriendRequest,
  useAcceptFriendRequest,
  useDeclineFriendRequest,
  useRemoveFriend,
  getListFriendsQueryKey,
  getListFriendRequestsQueryKey,
  getGetFriendsActivityQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Users, UserPlus, Activity, Check, X, Search, UserX, Bell, Music } from "lucide-react";
import { format, parseISO } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

type Tab = 'feed' | 'friends' | 'find';

function Avatar({ username, profileImageUrl, size = "md" }: { username: string; profileImageUrl?: string | null; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-14 h-14 text-lg" };
  return (
    <div className={`${sizes[size]} rounded-full bg-gradient-to-br from-primary/40 to-secondary/40 border border-white/10 overflow-hidden flex items-center justify-center shrink-0`}>
      {profileImageUrl ? (
        <img src={profileImageUrl} alt={username} className="w-full h-full object-cover" />
      ) : (
        <span className="font-bold text-white">{username.charAt(0).toUpperCase()}</span>
      )}
    </div>
  );
}

export function Friends() {
  const [activeTab, setActiveTab] = useState<Tab>('feed');
  const [searchQuery, setSearchQuery] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: friends, isLoading: loadingFriends } = useListFriends();
  const { data: activity, isLoading: loadingActivity } = useGetFriendsActivity();
  const { data: requests, isLoading: loadingRequests } = useListFriendRequests();
  const { data: searchResults, isLoading: loadingSearch } = useSearchUsers(
    { q: searchQuery },
    { query: { enabled: searchQuery.length > 2 } }
  );

  const { mutate: sendRequest, isPending: sendingRequest } = useSendFriendRequest();
  const { mutate: acceptRequest } = useAcceptFriendRequest();
  const { mutate: declineRequest } = useDeclineFriendRequest();
  const { mutate: removeFriend } = useRemoveFriend();

  const pendingCount = requests?.length ?? 0;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListFriendsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListFriendRequestsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetFriendsActivityQueryKey() });
  };

  const handleAccept = (id: string, username: string) => {
    acceptRequest({ id }, {
      onSuccess: () => {
        invalidateAll();
        toast({ title: "Friend added!", description: `You and @${username} are now friends.` });
      },
      onError: () => toast({ title: "Something went wrong", variant: "destructive" }),
    });
  };

  const handleDecline = (id: string, username: string) => {
    declineRequest({ id }, {
      onSuccess: () => {
        invalidateAll();
        toast({ title: "Request declined", description: `Declined request from @${username}.` });
      },
      onError: () => toast({ title: "Something went wrong", variant: "destructive" }),
    });
  };

  const handleAdd = (toUserId: string, username: string) => {
    sendRequest({ data: { toUserId } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/users/search'] });
        toast({ title: "Request sent!", description: `Friend request sent to @${username}.` });
      },
      onError: () => toast({ title: "Something went wrong", variant: "destructive" }),
    });
  };

  const handleRemove = (friendshipId: string, username: string) => {
    setRemovingId(friendshipId);
    removeFriend({ id: friendshipId }, {
      onSuccess: () => {
        invalidateAll();
        setRemovingId(null);
        toast({ title: "Friend removed", description: `@${username} was removed from your friends.` });
      },
      onError: () => {
        setRemovingId(null);
        toast({ title: "Something went wrong", variant: "destructive" });
      },
    });
  };

  const tabs: { id: Tab; label: string; icon: typeof Activity }[] = [
    { id: 'feed', label: 'Activity Feed', icon: Activity },
    { id: 'friends', label: 'My Friends', icon: Users },
    { id: 'find', label: 'Find People', icon: Search },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-5xl font-display tracking-wide text-foreground mb-2">
          The <span className="text-primary">Crew</span>
        </h1>
        <p className="text-muted-foreground font-medium">Build your concert squad and see who's going where.</p>
      </div>

      {/* Incoming Requests Banner — always visible when there are pending requests */}
      <AnimatePresence>
        {pendingCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="mb-6 bg-card border border-primary/40 rounded-2xl p-5 shadow-[0_0_30px_rgba(255,0,127,0.12)] relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary to-secondary rounded-l-2xl" />
            <div className="flex items-center gap-3 mb-4">
              <Bell className="w-5 h-5 text-primary" />
              <h3 className="font-display text-xl text-white">
                {pendingCount} Pending Friend {pendingCount === 1 ? 'Request' : 'Requests'}
              </h3>
            </div>
            <div className="space-y-3">
              {requests?.map(req => (
                <div key={req.id} className="flex items-center justify-between bg-background/60 rounded-xl px-4 py-3 border border-white/5">
                  <div className="flex items-center gap-3">
                    <Avatar username={req.fromUsername} size="md" />
                    <div>
                      <div className="font-bold text-foreground">@{req.fromUsername}</div>
                      <div className="text-xs text-muted-foreground">wants to be your friend</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAccept(req.id, req.fromUsername)}
                      className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                    >
                      <Check className="w-4 h-4" /> Accept
                    </button>
                    <button
                      onClick={() => handleDecline(req.id, req.fromUsername)}
                      className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-muted-foreground hover:text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                    >
                      <X className="w-4 h-4" /> Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tab Nav */}
      <div className="flex bg-card border border-border/50 p-1 rounded-xl shadow-lg mb-8">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all
              ${activeTab === tab.id
                ? 'bg-white/10 text-white shadow-md'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}
            `}
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:block">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* TAB: ACTIVITY FEED */}
      {activeTab === 'feed' && (
        <div className="space-y-4">
          {loadingActivity ? (
            <div className="p-12 text-center text-muted-foreground">Loading feed...</div>
          ) : !activity?.length ? (
            <div className="bg-card border border-border/50 rounded-2xl p-16 text-center shadow-lg">
              <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
              <h3 className="text-2xl font-display text-foreground mb-2">Nothing going on yet</h3>
              <p className="text-muted-foreground mb-6">Add some friends to see which shows they're hitting.</p>
              <button
                onClick={() => setActiveTab('find')}
                className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-colors inline-flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" /> Find People
              </button>
            </div>
          ) : (
            activity?.map((item, idx) => (
              <div key={idx} className="bg-card border border-border/50 rounded-2xl p-5 shadow-lg flex gap-4 hover:border-white/10 transition-colors">
                <div className="w-14 h-14 bg-muted rounded-xl flex flex-col items-center justify-center border border-border/50 shrink-0">
                  <span className="text-primary font-display text-xs leading-none">{format(parseISO(item.showDate), "MMM")}</span>
                  <span className="text-foreground font-display text-2xl leading-none">{format(parseISO(item.showDate), "dd")}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-lg font-display text-foreground truncate">{item.showTitle}</h4>
                  <p className="text-sm text-muted-foreground font-medium mb-3">{item.venueName} · {item.venueCity}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.friends.map(f => (
                      <div key={f.userId} className="flex items-center gap-1.5 bg-white/5 rounded-full pr-3 pl-1 py-1 border border-white/5">
                        <Avatar username={f.username} profileImageUrl={f.profileImageUrl} size="sm" />
                        <span className="text-xs font-bold text-foreground/80">{f.username}</span>
                        {f.boughtTickets && (
                          <span className="text-[10px] bg-secondary/20 text-secondary px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Tickets</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB: MY FRIENDS */}
      {activeTab === 'friends' && (
        <div className="space-y-4">
          {loadingFriends ? (
            <div className="p-12 text-center text-muted-foreground">Loading friends...</div>
          ) : !friends?.length ? (
            <div className="bg-card border border-border/50 rounded-2xl p-16 text-center shadow-lg">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
              <h3 className="text-2xl font-display text-foreground mb-2">No friends yet</h3>
              <p className="text-muted-foreground mb-6">Search for people you know and send them a request.</p>
              <button
                onClick={() => setActiveTab('find')}
                className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-colors inline-flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" /> Find People
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {friends.map(friend => (
                <div
                  key={friend.friendshipId}
                  className="flex items-center justify-between bg-card border border-border/50 rounded-2xl p-4 shadow-lg hover:border-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Avatar username={friend.username} profileImageUrl={friend.profileImageUrl} size="md" />
                    <div>
                      <div className="font-bold text-foreground">@{friend.username}</div>
                      <div className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                        <Music className="w-3 h-3" /> {friend.upcomingShowsCount} upcoming shows
                      </div>
                    </div>
                  </div>
                  <button
                    disabled={removingId === friend.friendshipId}
                    onClick={() => handleRemove(friend.friendshipId, friend.username)}
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 p-2 rounded-lg transition-colors disabled:opacity-50"
                    title="Remove friend"
                  >
                    <UserX className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: FIND PEOPLE */}
      {activeTab === 'find' && (
        <div className="space-y-6">
          <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-lg">
            <div className="relative mb-6">
              <Search className="w-5 h-5 text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full bg-background border-2 border-border/50 focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-xl py-3 pl-12 pr-4 text-foreground placeholder:text-muted-foreground transition-all outline-none font-medium"
              />
            </div>

            {searchQuery.length <= 2 && (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Type at least 3 characters to search</p>
              </div>
            )}

            {searchQuery.length > 2 && (
              <div className="space-y-3">
                {loadingSearch ? (
                  <div className="text-center py-8 text-muted-foreground">Searching...</div>
                ) : !searchResults?.length ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No users found for "<span className="text-foreground font-semibold">{searchQuery}</span>"
                  </div>
                ) : (
                  searchResults.map(user => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between bg-background/50 rounded-xl px-4 py-3 border border-border/50 hover:border-white/10 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar username={user.username} profileImageUrl={user.profileImageUrl} size="md" />
                        <div>
                          <div className="font-bold text-foreground">@{user.username}</div>
                        </div>
                      </div>

                      {user.isFriend ? (
                        <span className="text-sm font-bold text-secondary flex items-center gap-1.5 bg-secondary/10 px-3 py-1.5 rounded-full">
                          <Check className="w-3.5 h-3.5" /> Friends
                        </span>
                      ) : user.hasPendingRequest ? (
                        <span className="text-sm font-bold text-muted-foreground bg-white/5 border border-white/10 px-3 py-1.5 rounded-full">
                          Request Sent
                        </span>
                      ) : (
                        <button
                          disabled={sendingRequest}
                          onClick={() => handleAdd(user.id, user.username)}
                          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                        >
                          <UserPlus className="w-4 h-4" /> Add Friend
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
