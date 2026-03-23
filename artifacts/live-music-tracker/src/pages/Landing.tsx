import { useAuth } from "@workspace/replit-auth-web";
import { Redirect } from "wouter";
import { motion } from "framer-motion";
import { Disc3, ArrowRight } from "lucide-react";

export function Landing() {
  const { user, isLoading, login } = useAuth();

  if (isLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><Disc3 className="w-12 h-12 text-primary animate-spin" /></div>;
  if (user) return <Redirect to="/shows" />;

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src={`${import.meta.env.BASE_URL}images/hero-crowd.png`} 
          alt="Concert crowd" 
          className="w-full h-full object-cover opacity-40 mix-blend-luminosity"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/50 to-transparent" />
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full text-center sm:text-left sm:items-start">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-3xl"
        >
          <div className="flex items-center justify-center sm:justify-start gap-4 mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-[0_0_30px_rgba(255,0,127,0.5)]">
              <Disc3 className="w-10 h-10 text-white animate-spin" style={{ animationDuration: '4s' }} />
            </div>
            <h1 className="font-display text-4xl sm:text-5xl tracking-widest text-foreground mt-2">
              TRACK <span className="text-primary">THE</span> NOISE
            </h1>
          </div>

          <h2 className="font-display text-6xl sm:text-8xl lg:text-9xl leading-[0.9] tracking-tight text-white mb-6 drop-shadow-2xl">
            NEVER MISS <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
              A F*CKING SHOW
            </span>
          </h2>
          
          <p className="text-lg sm:text-xl text-muted-foreground font-medium mb-12 max-w-xl leading-relaxed">
            Connect with friends, track upcoming live music in your city, and know exactly who has tickets. The ultimate setlist for your social life.
          </p>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={login}
            className="group relative inline-flex items-center justify-center px-8 py-4 font-bold text-white bg-primary rounded-xl overflow-hidden shadow-[0_0_40px_rgba(255,0,127,0.4)] hover:shadow-[0_0_60px_rgba(0,240,255,0.6)] transition-shadow duration-500"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary to-secondary opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <span className="relative flex items-center gap-3 text-lg font-display tracking-widest">
              ENTER THE PIT <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </span>
          </motion.button>
        </motion.div>
      </div>

      <div className="relative z-10 py-8 text-center text-muted-foreground text-sm font-semibold tracking-widest uppercase">
        Built for the scene. Powered by Replit.
      </div>
    </div>
  );
}
