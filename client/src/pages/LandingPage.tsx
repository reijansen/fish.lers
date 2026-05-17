import { Link } from 'react-router-dom';
import { Fish, ClipboardList, Package, BarChart3, Users, Shield } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';

export default function LandingPage() {
  return (
  <div className="min-h-dvh bg-gradient-to-b from-base-200 via-base-200 to-primary/30 relative overflow-hidden">
      {/* Ocean/Fisheries themed background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Water wave gradients */}
    <div className="absolute -top-20 -left-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl"></div>
    <div className="absolute -bottom-40 -right-20 w-[500px] h-[500px] bg-primary/15 rounded-full blur-3xl"></div>
    <div className="absolute top-1/2 -left-40 w-80 h-80 bg-secondary/10 rounded-full blur-3xl"></div>
    <div className="absolute top-1/4 right-[10%] w-64 h-64 bg-secondary/10 rounded-full blur-3xl"></div>
        
        {/* Bubble elements */}
    <div className="absolute top-[15%] left-[10%] w-4 h-4 bg-primary/20 rounded-full animate-pulse"></div>
    <div className="absolute top-[25%] left-[20%] w-2 h-2 bg-primary/30 rounded-full"></div>
    <div className="absolute top-[40%] left-[8%] w-3 h-3 bg-primary/20 rounded-full animate-pulse" style={{animationDelay: '0.5s'}}></div>
    <div className="absolute top-[60%] left-[15%] w-2 h-2 bg-secondary/25 rounded-full"></div>
    <div className="absolute top-[75%] left-[12%] w-5 h-5 bg-primary/15 rounded-full animate-pulse" style={{animationDelay: '1s'}}></div>
        
    <div className="absolute top-[20%] right-[15%] w-3 h-3 bg-primary/20 rounded-full animate-pulse" style={{animationDelay: '0.3s'}}></div>
    <div className="absolute top-[35%] right-[10%] w-2 h-2 bg-primary/25 rounded-full"></div>
    <div className="absolute top-[50%] right-[20%] w-4 h-4 bg-secondary/15 rounded-full animate-pulse" style={{animationDelay: '0.7s'}}></div>
    <div className="absolute top-[70%] right-[8%] w-2 h-2 bg-primary/30 rounded-full"></div>

        {/* Fish silhouettes */}
    <svg className="absolute top-[15%] left-[5%] w-16 h-10 text-primary/10 rotate-12" viewBox="0 0 24 16" fill="currentColor">
          <path d="M17 8c3-2 5-2 7 0-2 2-4 2-7 0zm-2 0c-3 4-8 6-12 4 0-2 1-4 3-4-2 0-3-2-3-4 4-2 9 0 12 4z"/>
        </svg>
  <svg className="absolute top-[30%] right-[5%] w-20 h-12 text-primary/8 -rotate-6" viewBox="0 0 24 16" fill="currentColor">
          <path d="M17 8c3-2 5-2 7 0-2 2-4 2-7 0zm-2 0c-3 4-8 6-12 4 0-2 1-4 3-4-2 0-3-2-3-4 4-2 9 0 12 4z"/>
        </svg>
  <svg className="absolute top-[55%] left-[3%] w-14 h-8 text-secondary/10 rotate-[-15deg]" viewBox="0 0 24 16" fill="currentColor">
          <path d="M17 8c3-2 5-2 7 0-2 2-4 2-7 0zm-2 0c-3 4-8 6-12 4 0-2 1-4 3-4-2 0-3-2-3-4 4-2 9 0 12 4z"/>
        </svg>
  <svg className="absolute top-[70%] right-[8%] w-12 h-7 text-primary/8 rotate-6" viewBox="0 0 24 16" fill="currentColor">
          <path d="M17 8c3-2 5-2 7 0-2 2-4 2-7 0zm-2 0c-3 4-8 6-12 4 0-2 1-4 3-4-2 0-3-2-3-4 4-2 9 0 12 4z"/>
        </svg>

        {/* Wave patterns - layered at bottom */}
        <div className="absolute bottom-0 left-0 w-full h-48 overflow-hidden">
          <svg className="absolute bottom-0 left-0 w-[200%] h-full text-primary/40 animate-[wave_20s_ease-in-out_infinite]" viewBox="0 0 2880 120" preserveAspectRatio="none">
            <path fill="currentColor" d="M0,40 C240,100 480,0 720,50 C960,100 1200,10 1440,40 C1680,100 1920,0 2160,50 C2400,100 2640,10 2880,40 L2880,120 L0,120 Z"></path>
          </svg>
          <svg className="absolute bottom-0 left-0 w-[200%] h-36 text-primary/50 animate-[wave_15s_ease-in-out_infinite_reverse]" viewBox="0 0 2880 120" preserveAspectRatio="none">
            <path fill="currentColor" d="M0,60 C360,10 720,90 1080,30 C1440,60 1800,10 2160,90 C2520,30 2700,50 2880,60 L2880,120 L0,120 Z"></path>
          </svg>
          <svg className="absolute bottom-0 left-0 w-[200%] h-28 text-primary/60 animate-[wave_10s_ease-in-out_infinite]" viewBox="0 0 2880 120" preserveAspectRatio="none">
            <path fill="currentColor" d="M0,70 C180,30 360,90 540,50 C720,10 900,70 1080,40 C1260,10 1440,70 1620,30 C1800,90 1980,50 2160,10 C2340,70 2520,40 2700,10 C2800,50 2850,70 2880,70 L2880,120 L0,120 Z"></path>
          </svg>
        </div>
      </div>

      {/* Navbar */}
  <nav className="navbar bg-base-100/80 backdrop-blur-md shadow-sm sticky top-0 z-50 border-b border-primary/10 px-3 sm:px-4">
        <div className="navbar-start">
          <Link to="/" className="btn btn-ghost text-xl gap-2 h-auto py-2">
            <Fish className="w-6 h-6 text-primary" />
            <div className="flex flex-col items-start">
              <span className="font-bold leading-tight">FishLERS</span>
              <span className="text-[10px] text-base-content/60 font-normal hidden sm:block leading-tight">UPV CFOS IA-MSH</span>
            </div>
          </Link>
        </div>
        <div className="navbar-end gap-1 sm:gap-2 flex-nowrap">
          <ThemeToggle />
          <Link to="/login" className="btn btn-ghost btn-sm min-h-11 sm:btn-md">Log In</Link>
          <Link to="/signup" className="btn btn-primary btn-sm min-h-11 sm:btn-md">Sign Up</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero min-h-[50vh] relative z-10">
        <div className="hero-content text-center py-12">
          <div className="max-w-3xl">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <Fish className="w-12 h-12 text-primary" />
              </div>
            </div>
            <p className="text-sm md:text-base text-primary font-semibold mb-2 tracking-wide uppercase">
              University of the Philippines Visayas
            </p>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Institute of Aquaculture
              <span className="text-primary block mt-1">Multi-Species Hatchery</span>
            </h1>
            <p className="text-xs text-base-content/50 mb-2">College of Fisheries and Ocean Sciences</p>
            <p className="text-base md:text-lg text-base-content/70 mb-6 max-w-2xl mx-auto">
              Laboratory Equipment Reservation System — Streamline equipment borrowing for aquaculture research and hatchery operations.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link to="/signup" className="btn btn-primary shadow-lg shadow-primary/30">
                Get Started
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </Link>
              <Link to="/login" className="btn btn-outline">
                Log In
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-10 sm:py-12 px-4 sm:px-6 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Why Choose FishLERS?</h2>
            <p className="text-base-content/70 text-sm max-w-xl mx-auto">
              A comprehensive solution designed for the IA-MSH laboratory equipment management and aquaculture research needs.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Feature Card 1 */}
            <div className="card bg-base-100/80 backdrop-blur-sm shadow-md border border-primary/10 hover:shadow-lg transition-shadow">
              <div className="card-body p-4">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-2">
                  <ClipboardList className="w-5 h-5 text-primary" />
                </div>
                <h3 className="card-title text-base">Easy Reservations</h3>
                <p className="text-base-content/70 text-sm">
                  Submit hatchery equipment reservations quickly with our intuitive form system.
                </p>
              </div>
            </div>

            {/* Feature Card 2 */}
            <div className="card bg-base-100/80 backdrop-blur-sm shadow-md border border-primary/10 hover:shadow-lg transition-shadow">
              <div className="card-body p-4">
                <div className="w-10 h-10 bg-secondary/10 rounded-lg flex items-center justify-center mb-2">
                  <Package className="w-5 h-5 text-secondary" />
                </div>
                <h3 className="card-title text-base">Equipment Tracking</h3>
                <p className="text-base-content/70 text-sm">
                  Monitor borrowed lab equipment status and return schedules.
                </p>
              </div>
            </div>

            {/* Feature Card 3 */}
            <div className="card bg-base-100/80 backdrop-blur-sm shadow-md border border-primary/10 hover:shadow-lg transition-shadow">
              <div className="card-body p-4">
                <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center mb-2">
                  <BarChart3 className="w-5 h-5 text-accent" />
                </div>
                <h3 className="card-title text-base">Accountability Reports</h3>
                <p className="text-base-content/70 text-sm">
                  View borrowing history and generate accountability records.
                </p>
              </div>
            </div>

            {/* Feature Card 4 */}
            <div className="card bg-base-100/80 backdrop-blur-sm shadow-md border border-primary/10 hover:shadow-lg transition-shadow">
              <div className="card-body p-4">
                <div className="w-10 h-10 bg-info/10 rounded-lg flex items-center justify-center mb-2">
                  <Users className="w-5 h-5 text-info" />
                </div>
                <h3 className="card-title text-base">Student Portal</h3>
                <p className="text-base-content/70 text-sm">
                  Dedicated dashboard for CFOS students and researchers.
                </p>
              </div>
            </div>

            {/* Feature Card 5 */}
            <div className="card bg-base-100/80 backdrop-blur-sm shadow-md border border-primary/10 hover:shadow-lg transition-shadow">
              <div className="card-body p-4">
                <div className="w-10 h-10 bg-warning/10 rounded-lg flex items-center justify-center mb-2">
                  <Shield className="w-5 h-5 text-warning" />
                </div>
                <h3 className="card-title text-base">Admin Control</h3>
                <p className="text-base-content/70 text-sm">
                  Powerful tools for IA-MSH staff to manage inventory and approvals.
                </p>
              </div>
            </div>

            {/* Feature Card 6 */}
            <div className="card bg-base-100/80 backdrop-blur-sm shadow-md border border-primary/10 hover:shadow-lg transition-shadow">
              <div className="card-body p-4">
                <div className="w-10 h-10 bg-success/10 rounded-lg flex items-center justify-center mb-2">
                  <Fish className="w-5 h-5 text-success" />
                </div>
                <h3 className="card-title text-base">Aquaculture Focused</h3>
                <p className="text-base-content/70 text-sm">
                  Built specifically for multi-species hatchery laboratory needs.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-10 sm:py-12 px-4 sm:px-6 relative z-10">
        <div className="max-w-2xl mx-auto">
          <div className="card bg-primary/80 backdrop-blur-sm text-primary-content shadow-lg border border-primary/30">
            <div className="card-body text-center py-8">
              <h2 className="text-2xl font-bold mb-2">Ready to Get Started?</h2>
              <p className="mb-6 opacity-80 text-sm max-w-md mx-auto">
                Access the IA-MSH equipment reservation system and simplify your laboratory management.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link to="/signup" className="btn btn-primary btn-sm">
                  Create Account
                </Link>
                <Link to="/signup?role=admin" className="btn btn-outline btn-sm border-primary/50 text-primary-content hover:bg-primary-content hover:text-primary">
                  Register as Admin
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer with waves */}
      <footer className="relative z-10 mt-auto">
        {/* Footer waves */}
        <div className="h-24 relative overflow-hidden">
          <svg className="absolute bottom-0 left-0 w-[200%] h-full text-primary/50 animate-[wave_18s_ease-in-out_infinite]" viewBox="0 0 2880 120" preserveAspectRatio="none">
            <path fill="currentColor" d="M0,50 C240,90 480,20 720,60 C960,100 1200,30 1440,50 C1680,90 1920,20 2160,60 C2400,100 2640,30 2880,50 L2880,120 L0,120 Z"></path>
          </svg>
          <svg className="absolute bottom-0 left-0 w-[200%] h-20 text-primary/60 animate-[wave_12s_ease-in-out_infinite_reverse]" viewBox="0 0 2880 120" preserveAspectRatio="none">
            <path fill="currentColor" d="M0,70 C360,30 720,90 1080,50 C1440,70 1800,30 2160,90 C2520,50 2700,60 2880,70 L2880,120 L0,120 Z"></path>
          </svg>
          <svg className="absolute bottom-0 left-0 w-[200%] h-16 text-primary/70 animate-[wave_8s_ease-in-out_infinite]" viewBox="0 0 2880 120" preserveAspectRatio="none">
            <path fill="currentColor" d="M0,80 C180,50 360,100 540,70 C720,40 900,90 1080,60 C1260,30 1440,80 1620,50 C1800,100 1980,70 2160,40 C2340,90 2520,60 2700,30 C2800,70 2850,90 2880,80 L2880,120 L0,120 Z"></path>
          </svg>
        </div>
        <div className="bg-primary/90 backdrop-blur-md text-primary-content py-4 px-4">
          <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs">
            <div className="flex items-center gap-2">
              <Fish className="w-4 h-4" />
              <span className="font-semibold">FishLERS</span>
            </div>
            <span className="text-primary-content/30 hidden sm:inline">|</span>
            <span className="text-primary-content/70">UPV CFOS IA-MSH</span>
            <span className="text-primary-content/30 hidden sm:inline">|</span>
            <span className="text-primary-content/50">© {new Date().getFullYear()} Laboratory Equipment Reservation System</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
