import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Input, Checkbox } from '../components/Common';
import { Mail, Lock, Chrome, ArrowRight, Wand2, Bot, TrendingUp, BarChart2, CheckCircle, ChevronDown, Activity, Zap } from 'lucide-react';
import { useAuth } from '../App';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import StarBackground from '../components/StarBackground';

// --- Scroll Reveal Hook ---
const useScrollReveal = () => {
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1 });

    const elements = document.querySelectorAll('.reveal-section');
    elements.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, []);
};

const Auth: React.FC = () => {
  useScrollReveal();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();
  const authSectionRef = useRef<HTMLDivElement>(null);

  const scrollToAuth = () => {
    authSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (isSignUp) {
        const user = await authService.register(email, password);
        login(user);
        navigate('/');
      } else {
        const user = await authService.login(email, password);
        login(user);
        navigate('/');
      }
    } catch (error) {
      console.error("Auth failed", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setIsLoading(true);
    try {
      const user = await authService.loginWithGoogle();
      login(user);
      navigate('/');
    } catch (error) {
      console.error("Google Auth failed", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email) return;
    setIsLoading(true);
    try {
      await authService.sendMagicLink(email);
      setMagicLinkSent(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-900 text-white overflow-x-hidden">
      <StarBackground />
      
      {/* --- HERO SECTION --- */}
      <section className="relative h-screen flex flex-col items-center justify-center text-center px-4 pt-16 z-10">
         {/* Animated Glow Orbs */}
         <div className="glow-orb bg-accent-primary top-1/4 left-1/4 w-64 h-64 animate-float"></div>
         <div className="glow-orb bg-success bottom-1/4 right-1/4 w-48 h-48 animate-float" style={{animationDelay: '2s'}}></div>

         <div className="relative z-10 max-w-4xl mx-auto space-y-8 animate-fade-in-up">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
               <span className="bg-gradient-to-r from-white via-accent-primary to-accent-secondary bg-clip-text text-transparent">
                  YOTA
               </span>
               <span className="block text-2xl md:text-4xl mt-4 text-white font-medium">
                  AI-Powered Trading Signals
               </span>
            </h1>
            
            <p className="text-xl text-text-secondary max-w-2xl mx-auto">
               Real-time market analysis. Intelligent signal generation. Track your performance with the smartest agent on Solana.
            </p>

            <div className="flex flex-col md:flex-row gap-4 justify-center items-center py-6">
               <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-full px-6 py-3 flex items-center gap-2">
                  <Bot className="text-accent-primary" /> <span>Yota Agent</span>
               </div>
               <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-full px-6 py-3 flex items-center gap-2">
                  <Activity className="text-success" /> <span>Performance Tracking</span>
               </div>
               <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-full px-6 py-3 flex items-center gap-2">
                  <Zap className="text-warning" /> <span>Live Data</span>
               </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center w-full max-w-sm mx-auto sm:max-w-none">
               <Button onClick={scrollToAuth} className="px-8 py-4 text-lg w-full sm:w-auto">
                  Get Started Free
               </Button>
               <Button variant="secondary" className="px-8 py-4 text-lg w-full sm:w-auto">
                  View Demo
               </Button>
            </div>
         </div>

         <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce opacity-50">
            <span className="text-xs text-text-muted mb-2 block">Scroll to explore</span>
            <ChevronDown size={24} className="mx-auto"/>
         </div>
      </section>

      {/* --- WHAT IS YOTA --- */}
      <section className="py-24 px-4 bg-[#0d1421] relative z-10 reveal-section">
         <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
               <h2 className="text-3xl md:text-4xl font-bold mb-4">What is Yota?</h2>
               <p className="text-text-secondary max-w-2xl mx-auto text-lg">
                  Your AI-powered trading companion for Solana perpetuals. We combine machine learning with proven ICT strategies.
               </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
               <Card className="p-8 hover:-translate-y-2 transition-transform duration-300">
                  <div className="w-16 h-16 bg-accent-primary/20 rounded-2xl flex items-center justify-center mb-6 text-accent-primary">
                     <Bot size={32} />
                  </div>
                  <h3 className="text-xl font-bold mb-3">Yota Agent</h3>
                  <p className="text-text-secondary leading-relaxed">
                     Our AI monitors the market 24/7, detecting high-probability setups using Silver Bullet & Order Block strategies. It learns from every trade.
                  </p>
               </Card>

               <Card className="p-8 hover:-translate-y-2 transition-transform duration-300">
                  <div className="w-16 h-16 bg-success/20 rounded-2xl flex items-center justify-center mb-6 text-success">
                     <TrendingUp size={32} />
                  </div>
                  <h3 className="text-xl font-bold mb-3">Real-Time Signals</h3>
                  <p className="text-text-secondary leading-relaxed">
                     Get instant LONG and SHORT signals with precise entry, stop loss, and take profit levels. Each signal includes confidence scoring.
                  </p>
               </Card>

               <Card className="p-8 hover:-translate-y-2 transition-transform duration-300">
                  <div className="w-16 h-16 bg-warning/20 rounded-2xl flex items-center justify-center mb-6 text-warning">
                     <BarChart2 size={32} />
                  </div>
                  <h3 className="text-xl font-bold mb-3">Track & Improve</h3>
                  <p className="text-text-secondary leading-relaxed">
                     Log your trades, view PNL calendars, and analyze win rates. The Yota Agent tracks its own accuracy so you always know its performance.
                  </p>
               </Card>
            </div>
         </div>
      </section>

      {/* --- HOW IT WORKS TIMELINE --- */}
      <section className="py-24 px-4 bg-[#0a0f1a] relative z-10 reveal-section">
         <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-16 text-center">How Yota Works</h2>
            
            <div className="relative">
               {/* Vertical Line */}
               <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-accent-primary to-transparent md:-translate-x-1/2"></div>

               <div className="space-y-16">
                  {/* Step 1 */}
                  <div className="relative flex flex-col md:flex-row items-center md:justify-between gap-8 group">
                     <div className="md:w-5/12 text-left md:text-right order-2 md:order-1 pl-20 md:pl-0">
                        <h3 className="text-xl font-bold text-accent-primary mb-2">1. Market Monitoring</h3>
                        <p className="text-text-secondary">Yota continuously scans SOL-PERP price action using real-time aggregated data from top exchanges.</p>
                     </div>
                     <div className="absolute left-8 md:left-1/2 w-4 h-4 bg-accent-primary rounded-full md:-translate-x-1/2 border-4 border-navy-900 z-10 shadow-[0_0_15px_rgba(139,92,246,0.8)]"></div>
                     <div className="md:w-5/12 order-3 pl-20 md:pl-0 opacity-50 group-hover:opacity-100 transition-opacity">
                        {/* Visual placeholder */}
                        <div className="h-2 w-32 bg-navy-700 rounded-full overflow-hidden">
                           <div className="h-full bg-accent-primary w-2/3 animate-pulse"></div>
                        </div>
                     </div>
                  </div>

                  {/* Step 2 */}
                  <div className="relative flex flex-col md:flex-row items-center md:justify-between gap-8 group">
                     <div className="md:w-5/12 order-3 md:order-1 pl-20 md:pl-0 opacity-50 group-hover:opacity-100 transition-opacity text-right">
                         <div className="inline-block h-8 w-8 rounded bg-navy-700 border border-border"></div>
                     </div>
                     <div className="absolute left-8 md:left-1/2 w-4 h-4 bg-white rounded-full md:-translate-x-1/2 border-4 border-navy-900 z-10"></div>
                     <div className="md:w-5/12 text-left order-2 pl-20 md:pl-0">
                        <h3 className="text-xl font-bold text-white mb-2">2. Pattern Detection</h3>
                        <p className="text-text-secondary">When price enters a valid setup (Silver Bullet or OB) during key sessions, the agent identifies the opportunity.</p>
                     </div>
                  </div>

                  {/* Step 3 */}
                  <div className="relative flex flex-col md:flex-row items-center md:justify-between gap-8 group">
                     <div className="md:w-5/12 text-left md:text-right order-2 md:order-1 pl-20 md:pl-0">
                        <h3 className="text-xl font-bold text-success mb-2">3. Signal Generation</h3>
                        <p className="text-text-secondary">A detailed signal is generated with Entry, Stop Loss, Take Profit, and Yota's confidence level.</p>
                     </div>
                     <div className="absolute left-8 md:left-1/2 w-4 h-4 bg-success rounded-full md:-translate-x-1/2 border-4 border-navy-900 z-10 shadow-[0_0_15px_rgba(34,197,94,0.8)]"></div>
                     <div className="md:w-5/12 order-3 pl-20 md:pl-0"></div>
                  </div>

                  {/* Step 4 */}
                  <div className="relative flex flex-col md:flex-row items-center md:justify-between gap-8 group">
                     <div className="md:w-5/12 order-3 md:order-1 pl-20 md:pl-0"></div>
                     <div className="absolute left-8 md:left-1/2 w-4 h-4 bg-white rounded-full md:-translate-x-1/2 border-4 border-navy-900 z-10"></div>
                     <div className="md:w-5/12 text-left order-2 pl-20 md:pl-0">
                        <h3 className="text-xl font-bold text-white mb-2">4. Self-Learning</h3>
                        <p className="text-text-secondary">After each signal, Yota tracks the outcome to continuously refine its algorithm and improve accuracy.</p>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </section>

      {/* --- AUTH / FOOTER SECTION --- */}
      <section ref={authSectionRef} className="py-24 px-4 bg-gradient-to-b from-[#0d1421] to-[#0a0f1a] relative z-10">
         <div className="max-w-md mx-auto relative">
            <div className="absolute -top-20 -left-20 w-64 h-64 bg-accent-primary/10 rounded-full blur-3xl"></div>
            
            <div className="text-center mb-10">
               <h2 className="text-3xl font-bold mb-4">Ready to Start Trading Smarter?</h2>
               <p className="text-text-secondary">Join thousands of traders using Yota Agent.</p>
            </div>

            <Card className="bg-navy-800/90 backdrop-blur border-border/50 shadow-2xl relative z-10">
               {magicLinkSent ? (
                  <div className="text-center py-8 space-y-4 animate-fade-in">
                    <div className="w-16 h-16 bg-success/20 text-success rounded-full flex items-center justify-center mx-auto mb-4">
                      <Mail size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-white">Check your email</h3>
                    <p className="text-text-secondary">We sent a magic link to <span className="text-white font-bold">{email}</span></p>
                    <Button variant="outline" onClick={() => setMagicLinkSent(false)} className="w-full mt-4">
                      Back to Sign In
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Social Auth */}
                    <Button variant="outline" className="w-full flex items-center justify-center gap-3 py-3" onClick={handleGoogleAuth} disabled={isLoading}>
                      <Chrome size={20} />
                      Continue with Google
                    </Button>

                    <div className="relative flex items-center justify-center">
                      <div className="absolute w-full border-t border-border"></div>
                      <span className="relative bg-navy-800 px-3 text-xs text-text-muted uppercase tracking-wider">Or continue with email</span>
                    </div>

                    {/* Email Form */}
                    <form onSubmit={handleAuth} className="space-y-4">
                      <Input 
                        label="Email Address" 
                        type="email" 
                        placeholder="trader@example.com"
                        icon={<Mail size={16}/>}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                      
                      <Input 
                        label="Password" 
                        type="password" 
                        placeholder="••••••••"
                        icon={<Lock size={16}/>}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required={!isSignUp} 
                      />

                      <div className="flex justify-between items-center">
                        <Checkbox 
                          label="Remember me" 
                          checked={rememberMe} 
                          onChange={setRememberMe} 
                        />
                        {!isSignUp && (
                          <button type="button" onClick={handleMagicLink} className="text-sm text-accent-primary hover:text-accent-secondary flex items-center gap-1 transition-colors">
                            <Wand2 size={14} /> Magic Link
                          </button>
                        )}
                      </div>

                      <Button type="submit" className="w-full py-3 mt-2" disabled={isLoading}>
                        {isLoading ? (
                          <span className="animate-pulse">Processing...</span>
                        ) : (
                          <>
                            {isSignUp ? "Create Account" : "Sign In"} <ArrowRight size={18} />
                          </>
                        )}
                      </Button>
                    </form>

                    {/* Toggle */}
                    <p className="text-center text-sm text-text-secondary mt-6">
                      {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
                      <button 
                        onClick={() => { setIsSignUp(!isSignUp); setMagicLinkSent(false); }} 
                        className="text-accent-primary hover:text-white font-bold transition-colors ml-1"
                      >
                        {isSignUp ? "Sign In" : "Sign Up"}
                      </button>
                    </p>
                  </div>
                )}
            </Card>

            <footer className="mt-16 text-center text-xs text-text-muted space-y-4">
               <div className="flex justify-center gap-6">
                  <a href="#" className="hover:text-white">About</a>
                  <a href="#" className="hover:text-white">Terms</a>
                  <a href="#" className="hover:text-white">Privacy</a>
                  <a href="#" className="hover:text-white">Contact</a>
               </div>
               <p>© 2026 Yota Signal Tracker. Not financial advice.</p>
            </footer>
         </div>
      </section>
    </div>
  );
};

export default Auth;
