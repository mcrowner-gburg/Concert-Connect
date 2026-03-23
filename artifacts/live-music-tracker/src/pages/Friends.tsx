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
import { Users, UserPlus, Activity, Check, X, Search, UserX } from "lucide-react";
import { format, parseISO } from "date-fns";

export function Friends() {
  const [activeTab, setActiveTab] = useState<'activity' | 'friends' | 'find'>('activity');
  const [searchQuery, setSearchQuery] = useState("");
  
  const queryClient = useQueryClient();

  // Queries
  const { data: friends, isLoading: loadingFriends } = useListFriends();
  const { data: activity, isLoading: loadingActivity } = useGetFriendsActivity();
  const { data: requests } = useListFriendRequests();
  const { data: searchResults, isLoading: loadingSearch } = useSearchUsers({ q: searchQuery }, { query: { enabled: searchQuery.length > 2 } });

  // Mutations
  const { mutate: sendRequest } = useSendFriendRequest();
  const { mutate: acceptRequest } = useAcceptFriendRequest();
  const { mutate: declineRequest } = useDeclineFriendRequest();
  const { mutate: removeFriend } = useRemoveFriend();

  const invalidateFriends = () => {
    queryClient.invalidateQueries({ queryKey: getListFriendsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListFriendRequestsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetFriendsActivityQueryKey() });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="text-5xl font-display tracking-wide text-foreground mb-2">The <span className="text-primary">Crew</span></h1>
          <p className="text-muted-foreground font-medium">See who's going where, and build your concert squad.</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-card border border-border/50 p-1 rounded-xl shadow-lg w-full md:w-auto">
          {[
            { id: 'activity', label: 'Feed', icon: Activity },
            { id: 'friends', label: 'Friends', icon: Users },
            { id: 'find', label: 'Find Users', icon: Search }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`
                flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all
                ${activeTab === tab.id 
                  ? 'bg-white/10 text-white shadow-md' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}
              `}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.id === 'friends' && requests && requests.length > 0 && (
                <span className="bg-primary text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                  {requests.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Area based on Tab */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* TAB: ACTIVITY */}
          {activeTab === 'activity' && (
            <div className="space-y-6">
              {loadingActivity ? (
                <div className="p-8 text-center text-muted-foreground">Loading feed...</div>
              ) : activity?.length === 0 ? (
                <div className="bg-card border border-border/50 rounded-2xl p-12 text-center shadow-lg">
                  <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <h3 className="text-2xl font-display text-foreground mb-2">Quiet out there</h3>
                  <p className="text-muted-foreground">Your friends haven't marked themselves as going to any shows yet.</p>
                </div>
              ) : (
                activity?.map((item, idx) => (
                  <div key={idx} className="bg-card border border-border/50 rounded-2xl p-6 shadow-lg flex gap-4 hover:border-white/10 transition-colors">
                    <div className="w-16 h-16 bg-muted rounded-xl flex flex-col items-center justify-center border border-border/50 shrink-0">
                      <span className="text-primary font-display text-sm leading-none">{format(parseISO(item.showDate), "MMM")}</span>
                      <span className="text-foreground font-display text-2xl leading-none">{format(parseISO(item.showDate), "dd")}</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-xl font-display text-foreground leading-tight">{item.showTitle}</h4>
                      <p className="text-sm text-muted-foreground font-medium mb-3">{item.venueName} • {item.venueCity}</p>
                      
                      <div className="flex items-center gap-2 flex-wrap">
                        {item.friends.map(f => (
                          <div key={f.userId} className="flex items-center gap-2 bg-white/5 rounded-full pr-3 pl-1 py-1 border border-white/5">
                            <div className="w-6 h-6 rounded-full bg-muted overflow-hidden flex items-center justify-center">
                              {f.profileImageUrl ? (
                                <img src={f.profileImageUrl} alt={f.username} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-[10px] font-bold text-white">{f.username.charAt(0).toUpperCase()}</span>
                              )}
                            </div>
                            <span className="text-xs font-bold text-foreground/80">{f.username}</span>
                            {f.boughtTickets && <span className="text-[10px] bg-secondary/20 text-secondary px-1.5 rounded uppercase font-bold tracking-wider">Tickets</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB: FRIENDS */}
          {activeTab === 'friends' && (
            <div className="space-y-6">
              {/* Requests Section */}
              {requests && requests.length > 0 && (
                <div className="bg-card border border-primary/30 rounded-2xl p-6 shadow-[0_0_30px_rgba(255,0,127,0.1)] relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                  <h3 className="font-display text-2xl mb-4 flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-primary" /> Pending Requests
                  </h3>
                  <div className="space-y-3">
                    {requests.map(req => (
                      <div key={req.id} className="flex items-center justify-between bg-background/50 rounded-xl p-3 border border-border/50">
                        <span className="font-bold text-foreground">@{req.fromUsername}</span>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => acceptRequest({ id: req.id }, { onSuccess: invalidateFriends })}
                            className="bg-secondary/20 text-secondary hover:bg-secondary hover:text-black p-2 rounded-lg transition-colors"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => declineRequest({ id: req.id }, { onSuccess: invalidateFriends })}
                            className="bg-destructive/20 text-destructive hover:bg-destructive hover:text-white p-2 rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Friends List */}
              <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-lg">
                <h3 className="font-display text-2xl mb-6 flex items-center gap-2">
                  <Users className="w-5 h-5" /> My Squad
                </h3>
                {loadingFriends ? (
                  <div className="text-center py-4 text-muted-foreground">Loading...</div>
                ) : friends?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground border border-dashed border-border/50 rounded-xl">
                    You haven't added any friends yet. Hit the "Find Users" tab!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {friends?.map(friend => (
                      <div key={friend.friendshipId} className="flex items-center justify-between bg-background/50 rounded-xl p-4 border border-border/50 hover:border-white/10 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-muted overflow-hidden flex items-center justify-center border border-border">
                            {friend.profileImageUrl ? (
                              <img src={friend.profileImageUrl} alt={friend.username} className="w-full h-full object-cover" />
                            ) : (
                              <span className="font-bold text-white">{friend.username.charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-foreground">@{friend.username}</div>
                            <div className="text-xs text-muted-foreground font-medium">{friend.upcomingShowsCount} upcoming shows</div>
                          </div>
                        </div>
                        <button 
                          onClick={() => {
                            if(confirm(`Remove ${friend.username} from friends?`)) {
                              removeFriend({ id: friend.friendshipId }, { onSuccess: invalidateFriends });
                            }
                          }}
                          className="text-muted-foreground hover:text-destructive p-2"
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: FIND USERS */}
          {activeTab === 'find' && (
            <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-lg space-y-6">
              <div className="relative">
                <Search className="w-5 h-5 text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-background border-2 border-border/50 focus:border-secondary focus:ring-4 focus:ring-secondary/10 rounded-xl py-3 pl-12 pr-4 text-foreground placeholder:text-muted-foreground transition-all outline-none font-bold"
                />
              </div>

              {searchQuery.length > 2 && (
                <div className="space-y-3">
                  {loadingSearch ? (
                    <div className="text-center py-4 text-muted-foreground">Searching...</div>
                  ) : searchResults?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No users found matching "{searchQuery}"</div>
                  ) : (
                    searchResults?.map(user => (
                      <div key={user.id} className="flex items-center justify-between bg-background/50 rounded-xl p-4 border border-border/50">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-muted overflow-hidden flex items-center justify-center">
                            {user.profileImageUrl ? (
                              <img src={user.profileImageUrl} alt={user.username} className="w-full h-full object-cover" />
                            ) : (
                              <span className="font-bold text-white">{user.username.charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <div className="font-bold text-foreground">@{user.username}</div>
                        </div>
                        
                        {user.isFriend ? (
                          <span className="text-sm font-bold text-primary flex items-center gap-1 bg-primary/10 px-3 py-1 rounded-full"><Check className="w-3 h-3" /> Friends</span>
                        ) : user.hasPendingRequest ? (
                          <span className="text-sm font-bold text-muted-foreground bg-white/5 px-3 py-1 rounded-full">Request Sent</span>
                        ) : (
                          <button
                            onClick={() => sendRequest({ data: { toUserId: user.id } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/users/search'] }) })}
                            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
                          >
                            <UserPlus className="w-4 h-4" /> Add
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar Info */}
        <div className="hidden lg:block space-y-6">
          <div className="bg-gradient-to-br from-primary/20 to-card border border-primary/30 rounded-2xl p-6 shadow-[0_0_30px_rgba(255,0,127,0.1)]">
            <h3 className="font-display text-2xl mb-2 text-white">Why Add Friends?</h3>
            <p className="text-sm text-muted-foreground font-medium leading-relaxed mb-4">
              Building your crew unlocks the true power of the Tracker.
            </p>
            <ul className="space-y-3 text-sm text-foreground/80 font-medium">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" /> See which shows your friends are hitting
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" /> Know who already secured tickets so you can coordinate buys
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" /> Discover new bands based on what your squad is into
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
